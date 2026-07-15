import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.unmock('../src/services/job-queue.js');
import {
  initQueue,
  closeQueue,
  enqueueActionExecution,
  getJobStatus,
} from '../src/services/job-queue.js';
import * as ghExecutor from '../src/services/github-executor.js';
import * as k8sExecutor from '../src/services/kubernetes-executor.js';

vi.mock('../src/services/github-executor.js', () => ({
  executeGitHubWorkflow: vi.fn(),
}));

vi.mock('../src/services/kubernetes-executor.js', () => ({
  executeKubernetesRestart: vi.fn(),
  executeKubernetesScale: vi.fn(),
}));

const { mockJob, mockQueue, mockWorker, state } = vi.hoisted(() => {
  const mockJob = {
    id: 'job-1',
    data: {},
    discard: vi.fn(),
    getState: vi.fn().mockResolvedValue('completed'),
    progress: 100,
    failedReason: '',
    returnvalue: 'success',
    attemptsMade: 1,
  };

  return {
    mockJob,
    mockQueue: {
      add: vi.fn().mockResolvedValue(mockJob),
      getJob: vi.fn().mockResolvedValue(mockJob),
      close: vi.fn().mockResolvedValue(undefined),
    },
    mockWorker: {
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    },
    state: { workerCallback: null as unknown as (...args: unknown[]) => Promise<unknown> },
  };
});

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => mockQueue),
    Worker: vi.fn().mockImplementation((name, cb) => {
      state.workerCallback = cb;
      return mockWorker;
    }),
  };
});

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      disconnect: vi.fn(),
    })),
  };
});

describe('Background Job Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initQueue('redis://localhost:6379');
  });

  afterEach(async () => {
    await closeQueue();
  });

  it('enqueues a job with idempotency key', async () => {
    const jobId = await enqueueActionExecution(
      'plan-1',
      'user-1',
      'github.workflow.dispatch',
      'idemp-1',
    );

    expect(jobId).toBe('job-1');
    expect(mockQueue.add).toHaveBeenCalledWith(
      'execute-plan',
      {
        planId: 'plan-1',
        userId: 'user-1',
        actionType: 'github.workflow.dispatch',
        idempotencyKey: 'idemp-1',
      },
      { jobId: 'idemp-1' },
    );
  });

  it('gets job status safely', async () => {
    const status = await getJobStatus('job-1');
    expect(status).toMatchObject({
      id: 'job-1',
      state: 'completed',
    });
  });

  it('processes a job successfully', async () => {
    vi.mocked(ghExecutor.executeGitHubWorkflow).mockResolvedValueOnce({
      status: 'ok',
      message: 'success',
    });
    const result = await state.workerCallback({
      data: { planId: 'p-1', userId: 'u-1', actionType: 'github.workflow.dispatch' },
    });
    expect(result).toEqual({ status: 'ok', message: 'success' });
    expect(ghExecutor.executeGitHubWorkflow).toHaveBeenCalledWith('p-1', 'u-1');
  });

  it('handles non-retryable failure (dead-letter)', async () => {
    vi.mocked(k8sExecutor.executeKubernetesRestart).mockRejectedValueOnce(
      new Error('Plan is not in approved state'),
    );

    const job = {
      ...mockJob,
      data: { planId: 'p-2', actionType: 'kubernetes.deployment.restart' },
    };

    await expect(state.workerCallback(job)).rejects.toThrow('Plan is not in approved state');
    expect(job.discard).toHaveBeenCalled(); // Dead-lettered
  });

  it('handles retryable failure (transient)', async () => {
    vi.mocked(k8sExecutor.executeKubernetesScale).mockRejectedValueOnce(
      new Error('Connection reset by peer'),
    );

    const job = { ...mockJob, data: { planId: 'p-3', actionType: 'kubernetes.deployment.scale' } };

    await expect(state.workerCallback(job)).rejects.toThrow('Connection reset by peer');
    expect(job.discard).not.toHaveBeenCalled(); // Will retry
  });

  it('enforces job timeout', async () => {
    vi.mocked(ghExecutor.executeGitHubWorkflow).mockImplementationOnce(() => {
      return new Promise((resolve) => setTimeout(resolve, 35000));
    });

    const job = { ...mockJob, data: { actionType: 'github.workflow.dispatch' } };

    // Fake timers to advance time
    vi.useFakeTimers();
    const promise = state.workerCallback(job);
    vi.advanceTimersByTime(31000); // Past 30s timeout

    await expect(promise).rejects.toThrow('Job execution timed out');
    vi.useRealTimers();
  });
});
