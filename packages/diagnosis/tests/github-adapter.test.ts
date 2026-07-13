import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MockGitHubAdapter,
  RealGitHubAdapter,
  GitHubApiError,
  setGitHubAdapter,
} from '../src/github-adapter/index.js';
import { collectGitHubEvidence } from '../src/evidence-collector.js';

describe('MockGitHubAdapter', () => {
  const adapter = new MockGitHubAdapter();

  it('returns mock evidence when pipelineRunId is provided', async () => {
    const evidence = await adapter.collectEvidence('myorg/myapp/42');
    expect(evidence.source).toBe('github');
    expect(evidence.logs.length).toBeGreaterThan(0);
    expect(evidence.metadata.repo).toBe('myorg/myapp');
    expect(evidence.metadata.runUrl).toContain('github.com');
    expect(evidence.metadata.conclusion).toBe('failure');
    expect(evidence.metadata.failedJob).toBe('Deploy');
  });

  it('returns empty evidence when pipelineRunId is omitted', async () => {
    const evidence = await adapter.collectEvidence();
    expect(evidence.logs).toHaveLength(0);
    expect(evidence.metadata.note).toBe('No pipelineRunId provided');
  });

  it('returns workflow runs for a repository', async () => {
    const runs = await adapter.getWorkflowRuns('myorg/myapp');
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      id: 42,
      name: 'Deploy to Staging',
      status: 'completed',
      conclusion: 'failure',
    });
    expect(runs[0].url).toContain('myorg/myapp');
  });

  it('returns jobs for a workflow run', async () => {
    const jobs = await adapter.getJobs('myorg/myapp', 42);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].name).toBe('Build');
    expect(jobs[0].conclusion).toBe('success');
    expect(jobs[0].steps).toHaveLength(3);
    expect(jobs[1].name).toBe('Deploy');
    expect(jobs[1].conclusion).toBe('failure');
    expect(jobs[1].steps).toHaveLength(1);
  });

  it('returns mock job logs', async () => {
    const logs = await adapter.getJobLogs('myorg/myapp', 101);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toContain('[mock]');
  });
});

describe('RealGitHubAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws when token is missing', () => {
    expect(() => new RealGitHubAdapter({})).toThrow('GITHUB_TOKEN is required');
  });

  it('rejects repos not in the allowed list', async () => {
    const adapter = new RealGitHubAdapter({
      token: 'ghp_fake',
      allowedRepos: ['allowed/repo'],
    });
    await expect(adapter.collectEvidence('evil/repo/1')).rejects.toThrowError(GitHubApiError);
    await expect(adapter.collectEvidence('evil/repo/1')).rejects.toThrow(/not in the allowed list/);
  });

  it('returns empty evidence when pipelineRunId is omitted', async () => {
    const adapter = new RealGitHubAdapter({
      token: 'ghp_fake',
      allowedRepos: [],
    });
    const evidence = await adapter.collectEvidence();
    expect(evidence.logs).toHaveLength(0);
    expect(evidence.metadata.note).toBe('No pipelineRunId provided');
  });

  it('returns error metadata for invalid pipelineRunId format', async () => {
    const adapter = new RealGitHubAdapter({
      token: 'ghp_fake',
      allowedRepos: [],
    });
    const evidence = await adapter.collectEvidence('invalidformat');
    expect(evidence.metadata.error).toContain('Invalid pipelineRunId format');
  });

  it('returns error metadata for non-numeric run ID', async () => {
    const adapter = new RealGitHubAdapter({
      token: 'ghp_fake',
      allowedRepos: [],
    });
    const evidence = await adapter.collectEvidence('owner/repo/notanumber');
    expect(evidence.metadata.error).toContain('Invalid run_id');
  });

  it('fetches workflow runs via the GitHub API', async () => {
    const mockResponse = {
      workflow_runs: [
        {
          id: 1,
          name: 'CI',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/org/repo/actions/runs/1',
          created_at: '2026-07-13T10:00:00Z',
          updated_at: '2026-07-13T10:05:00Z',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const adapter = new RealGitHubAdapter({
      token: 'ghp_fake',
      allowedRepos: ['org/repo'],
    });
    const runs = await adapter.getWorkflowRuns('org/repo');
    expect(runs).toHaveLength(1);
    expect(runs[0].name).toBe('CI');
    expect(runs[0].conclusion).toBe('success');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/repos/org/repo/actions/runs'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_fake',
        }),
      }),
    );
  });

  it('throws GitHubApiError on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const adapter = new RealGitHubAdapter({
      token: 'ghp_fake',
      allowedRepos: ['org/repo'],
    });
    await expect(adapter.getWorkflowRuns('org/repo')).rejects.toThrowError(GitHubApiError);
    await expect(adapter.getWorkflowRuns('org/repo')).rejects.toThrow('GitHub API error: 404');
  });

  it('redacts secrets from job logs returned by collectEvidence', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions/runs/1/jobs')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              jobs: [
                {
                  id: 10,
                  name: 'Deploy',
                  status: 'completed',
                  conclusion: 'failure',
                  steps: [
                    { name: 'kubectl', status: 'completed', conclusion: 'failure', number: 1 },
                  ],
                },
              ],
            }),
        });
      }
      if (url.includes('/actions/jobs/10/logs')) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              'Error: something broke\nghp_abcdefghijklmnopqrstuvwxyz0123456789abcd\nend of log',
            ),
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const adapter = new RealGitHubAdapter({
      token: 'ghp_fake',
      allowedRepos: ['org/repo'],
    });
    const evidence = await adapter.collectEvidence('org/repo/1');
    const allLogs = evidence.logs.join('\n');
    expect(allLogs).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd');
    expect(allLogs).toContain('[REDACTED]');
  });

  it('redacts secrets from job log lines', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/actions/runs/1/jobs')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              jobs: [
                {
                  id: 10,
                  name: 'Test',
                  status: 'completed',
                  conclusion: 'failure',
                  steps: [{ name: 'run', status: 'completed', conclusion: 'failure', number: 1 }],
                },
              ],
            }),
        });
      }
      if (url.includes('/actions/jobs/10/logs')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('password = "super-secret"\ntoken=ghp_abc123'),
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const adapter = new RealGitHubAdapter({
      token: 'ghp_fake',
      allowedRepos: ['org/repo'],
    });
    const evidence = await adapter.collectEvidence('org/repo/1');
    const allLogs = evidence.logs.join('\n');
    expect(allLogs).not.toContain('super-secret');
    expect(allLogs).not.toContain('ghp_abc123');
    expect(allLogs.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('evidence-collector integration', () => {
  beforeEach(() => {
    setGitHubAdapter(new MockGitHubAdapter());
  });

  it('uses the configured adapter when pipelineRunId is provided', async () => {
    const evidence = await collectGitHubEvidence('myorg/myapp/42');
    expect(evidence.source).toBe('github');
    expect(evidence.logs.length).toBeGreaterThan(0);
    expect(evidence.metadata.repo).toBe('myorg/myapp');
  });

  it('falls back to stub when no adapter is set', async () => {
    setGitHubAdapter(null as unknown as MockGitHubAdapter);
    const evidence = await collectGitHubEvidence('some-run');
    expect(evidence.source).toBe('github');
    expect(evidence.logs[0]).toContain('[stub]');
  });

  it('returns empty logs when pipelineRunId is not provided', async () => {
    const evidence = await collectGitHubEvidence();
    expect(evidence.source).toBe('github');
    expect(evidence.metadata).toHaveProperty('note');
  });
});
