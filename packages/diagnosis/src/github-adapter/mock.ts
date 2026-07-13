import type { CollectedEvidence } from '@aapsd/contracts';
import type { GitHubAdapter, WorkflowRun, Job } from './types.js';
import { redactSecrets } from '../redactor.js';

export class MockGitHubAdapter implements GitHubAdapter {
  async collectEvidence(pipelineRunId?: string): Promise<CollectedEvidence> {
    if (!pipelineRunId) {
      return { source: 'github', logs: [], metadata: { note: 'No pipelineRunId provided' } };
    }

    const logs = [
      '[2026-07-13T10:00:00Z] Run workflow "Deploy to Staging" (run #42)',
      '[2026-07-13T10:01:15Z] Job "Build" — started',
      '[2026-07-13T10:02:30Z] Step "Checkout" — success (1.2s)',
      '[2026-07-13T10:02:45Z] Step "Docker build" — success (15.3s)',
      '[2026-07-13T10:03:00Z] Step "Docker push" — success (5.1s)',
      '[2026-07-13T10:03:10Z] Job "Build" — success',
      '[2026-07-13T10:03:15Z] Job "Deploy" — started',
      '[2026-07-13T10:03:20Z] Step "kubectl set image" — failure (exit code 1)',
      '[2026-07-13T10:03:20Z] Error: container image "myapp:sha-abc1234" not found',
      '[2026-07-13T10:03:21Z] Job "Deploy" — failure',
    ];

    return {
      source: 'github',
      logs: logs.map((log) => redactSecrets(log)),
      metadata: {
        repo: 'myorg/myapp',
        workflowName: 'Deploy to Staging',
        runId: 42,
        runUrl: 'https://github.com/myorg/myapp/actions/runs/42',
        conclusion: 'failure',
        failedJob: 'Deploy',
        failedStep: 'kubectl set image',
      },
    };
  }

  async getWorkflowRuns(repo: string, _limit = 5): Promise<WorkflowRun[]> {
    return [
      {
        id: 42,
        name: 'Deploy to Staging',
        status: 'completed',
        conclusion: 'failure',
        url: `https://github.com/${repo}/actions/runs/42`,
        createdAt: '2026-07-13T10:00:00Z',
        updatedAt: '2026-07-13T10:03:21Z',
      },
    ];
  }

  async getJobs(_repo: string, _runId: number): Promise<Job[]> {
    return [
      {
        id: 101,
        name: 'Build',
        status: 'completed',
        conclusion: 'success',
        steps: [
          { name: 'Checkout', status: 'completed', conclusion: 'success', number: 1 },
          { name: 'Docker build', status: 'completed', conclusion: 'success', number: 2 },
          { name: 'Docker push', status: 'completed', conclusion: 'success', number: 3 },
        ],
      },
      {
        id: 102,
        name: 'Deploy',
        status: 'completed',
        conclusion: 'failure',
        steps: [
          { name: 'kubectl set image', status: 'completed', conclusion: 'failure', number: 1 },
        ],
      },
    ];
  }

  async getJobLogs(_repo: string, jobId: number): Promise<string[]> {
    return [`[mock] Job ${jobId} log line 1`, `[mock] Job ${jobId} log line 2`];
  }
}
