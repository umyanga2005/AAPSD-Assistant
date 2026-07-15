import type { CollectedEvidence } from '@aapsd/contracts';
import type { GitHubAdapter, WorkflowRun, Job, Step } from './types.js';
import type { GitHubConfig } from './config.js';
import { redactSecrets } from '../redactor.js';

export class GitHubApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class RealGitHubAdapter implements GitHubAdapter {
  private token: string;
  private allowedRepos: string[];
  private baseUrl = 'https://api.github.com';

  constructor(config: GitHubConfig) {
    if (!config.token) {
      throw new Error('GITHUB_TOKEN is required for RealGitHubAdapter');
    }
    this.token = config.token;
    this.allowedRepos = config.allowedRepos ?? [];
  }

  private checkRepo(repo: string): void {
    if (this.allowedRepos.length > 0 && !this.allowedRepos.includes(repo)) {
      throw new GitHubApiError(403, `Repository "${repo}" is not in the allowed list`);
    }
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'aapsd-diagnosis',
      },
    });

    if (!response.ok) {
      throw new GitHubApiError(response.status, `GitHub API error: ${response.status} for ${path}`);
    }

    return response.json() as Promise<T>;
  }

  async collectEvidence(pipelineRunId?: string): Promise<CollectedEvidence> {
    if (!pipelineRunId) {
      return { source: 'github', logs: [], metadata: { note: 'No pipelineRunId provided' } };
    }

    const parts = pipelineRunId.split('/');
    if (parts.length < 3) {
      return {
        source: 'github',
        logs: [],
        metadata: { error: 'Invalid pipelineRunId format. Expected: owner/repo/run_id' },
      };
    }

    const repo = `${parts[0]}/${parts[1]}`;
    const runId = parseInt(parts.slice(2).join('/'), 10);
    if (isNaN(runId)) {
      return {
        source: 'github',
        logs: [],
        metadata: { error: 'Invalid run_id in pipelineRunId' },
      };
    }

    this.checkRepo(repo);

    let jobs: Job[] = [];
    try {
      jobs = await this.getJobs(repo, runId);
    } catch (err: unknown) {
      return {
        source: 'github',
        logs: [],
        metadata: { error: `Failed to fetch jobs: ${(err as Error)?.message || String(err)}` },
      };
    }
    const failedJobs = jobs.filter((j) => j.conclusion === 'failure');

    const logs: string[] = [];
    for (const job of failedJobs) {
      logs.push(`Job "${job.name}" — ${job.status} (conclusion: ${job.conclusion ?? 'null'})`);
      for (const step of job.steps) {
        logs.push(
          `  Step #${step.number} "${step.name}" — ${step.status} (${step.conclusion ?? 'null'})`,
        );
      }

      try {
        const jobLogs = await this.getJobLogs(repo, job.id);
        logs.push(...jobLogs);
      } catch {
        logs.push(`  [log fetch failed for job ${job.id}]`);
      }
    }

    let runUrl = `https://github.com/${repo}/actions/runs/${runId}`;
    let timestamp = new Date().toISOString();
    try {
      const runDetails = await this.request<{ html_url: string; created_at: string }>(`/repos/${repo}/actions/runs/${runId}`);
      runUrl = runDetails.html_url;
      timestamp = runDetails.created_at;
    } catch {
      // Ignore if we can't fetch run details
    }

    return {
      source: 'github',
      logs: logs.map((log) => redactSecrets(log)),
      metadata: {
        repo,
        runId,
        url: runUrl,
        timestamp,
        totalJobs: jobs.length,
        failedJobs: failedJobs.map((j) => j.name),
      },
    };
  }

  async getWorkflowRuns(repo: string, limit = 5, page = 1): Promise<WorkflowRun[]> {
    this.checkRepo(repo);
    const data = await this.request<{
      workflow_runs: Array<{
        id: number;
        name: string;
        status: string;
        conclusion: string | null;
        html_url: string;
        head_sha: string;
        created_at: string;
        updated_at: string;
      }>;
    }>(`/repos/${repo}/actions/runs?per_page=${limit}&page=${page}`);

    return data.workflow_runs.map((run) => ({
      id: run.id,
      name: run.name,
      status: run.status as WorkflowRun['status'],
      conclusion: run.conclusion as WorkflowRun['conclusion'],
      url: run.html_url,
      head_sha: run.head_sha,
      repo,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    }));
  }

  async getUserRepos(): Promise<string[]> {
    // Fetch all repositories the authenticated user has access to
    const data = await this.request<Array<{ full_name: string }>>(
      '/user/repos?per_page=100&sort=updated',
    );
    return data.map((r) => r.full_name);
  }

  async getJobs(repo: string, runId: number): Promise<Job[]> {
    this.checkRepo(repo);
    const data = await this.request<{
      jobs: Array<{
        id: number;
        name: string;
        status: string;
        conclusion: string | null;
        steps?: Array<{
          name: string;
          status: string;
          conclusion: string | null;
          number: number;
        }>;
      }>;
    }>(`/repos/${repo}/actions/runs/${runId}/jobs`);

    return data.jobs.map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status as Job['status'],
      conclusion: job.conclusion as Job['conclusion'],
      steps: (job.steps ?? []).map((step) => ({
        name: step.name,
        status: step.status as Step['status'],
        conclusion: step.conclusion as Step['conclusion'],
        number: step.number,
      })),
    }));
  }

  async getJobLogs(repo: string, jobId: number): Promise<string[]> {
    this.checkRepo(repo);
    const response = await fetch(`${this.baseUrl}/repos/${repo}/actions/jobs/${jobId}/logs`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'User-Agent': 'aapsd-diagnosis',
      },
    });

    if (!response.ok) {
      throw new GitHubApiError(
        response.status,
        `GitHub API error: ${response.status} for logs of job ${jobId}`,
      );
    }

    const text = await response.text();
    return text.split('\n').filter(Boolean);
  }
}
