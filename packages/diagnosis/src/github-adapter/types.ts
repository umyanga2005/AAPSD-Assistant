import type { CollectedEvidence } from '@aapsd/contracts';

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'completed' | 'in_progress' | 'queued' | 'cancelled';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  url: string;
  head_sha: string;
  createdAt: string;
  updatedAt: string;
}

export interface Step {
  name: string;
  status: 'completed' | 'in_progress' | 'queued';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  number: number;
}

export interface Job {
  id: number;
  name: string;
  status: 'completed' | 'in_progress' | 'queued';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  steps: Step[];
}

export interface GitHubAdapter {
  collectEvidence(pipelineRunId?: string): Promise<CollectedEvidence>;
  getWorkflowRuns(repo: string, limit?: number): Promise<WorkflowRun[]>;
  getJobs(repo: string, runId: number): Promise<Job[]>;
  getJobLogs(repo: string, jobId: number): Promise<string[]>;
}
