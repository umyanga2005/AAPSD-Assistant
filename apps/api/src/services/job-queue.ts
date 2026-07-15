import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { executeGitHubWorkflow } from './github-executor.js';
import { executeKubernetesRestart, executeKubernetesScale } from './kubernetes-executor.js';
import { apiExecutorJobsTotal, apiQueueDepthTotal } from '../index.js';

let connection: IORedis | undefined;
let executionQueue: Queue | undefined;
let worker: Worker | undefined;

export interface ExecutorJobData {
  planId: string;
  userId: string;
  actionType: string;
  idempotencyKey: string;
}

export function initQueue(redisUrl: string) {
  if (connection) return;
  connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  executionQueue = new Queue('action-executor', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: connection as any,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });

  worker = new Worker(
    'action-executor',
    async (job: Job<ExecutorJobData>) => {
      const { planId, userId, actionType } = job.data;

      // Enforce a hard timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Job execution timed out')), 30000),
      );

      try {
        let executionPromise;
        if (actionType === 'github.workflow.dispatch') {
          executionPromise = executeGitHubWorkflow(planId, userId);
        } else if (actionType === 'kubernetes.deployment.restart') {
          executionPromise = executeKubernetesRestart(planId, userId);
        } else if (actionType === 'kubernetes.deployment.scale') {
          executionPromise = executeKubernetesScale(planId, userId);
        } else {
          throw new Error('Unsupported action type for execution');
        }

        const result = await Promise.race([executionPromise, timeoutPromise]);
        apiExecutorJobsTotal.inc({ status: 'success' });
        return result;
      } catch (err: unknown) {
        const error = err as Error;
        // Known non-retryable errors
        if (
          error.message.includes('Plan is not in approved state') ||
          error.message.includes('Plan expired') ||
          error.message.includes('not found') ||
          error.message.includes('Unsupported action type')
        ) {
          // Do not retry these failures
          job.discard(); // Mark as dead-letter
        }
        apiExecutorJobsTotal.inc({ status: 'failed' });
        throw error;
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { connection: connection as any, concurrency: 5 },
  );

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`Job ${job?.id} failed with error: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error(`Worker error: ${err.message}`);
  });
}

export async function enqueueActionExecution(
  planId: string,
  userId: string,
  actionType: string,
  idempotencyKey: string,
): Promise<string> {
  if (!executionQueue) throw new Error('Queue not initialized');

  const job = await executionQueue.add(
    'execute-plan',
    { planId, userId, actionType, idempotencyKey },
    { jobId: idempotencyKey }, // bullmq deduplicates by jobId
  );

  return job.id!;
}

export async function getJobStatus(jobId: string) {
  if (!executionQueue) throw new Error('Queue not initialized');
  const job = await executionQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;
  const failedReason = job.failedReason;
  const returnvalue = job.returnvalue;

  let count = 0;
  if (typeof executionQueue.getWaitingCount === 'function') {
    count = await executionQueue.getWaitingCount();
  }
  apiQueueDepthTotal.set(count);

  return {
    id: job.id,
    state,
    progress,
    failedReason,
    returnvalue,
    attemptsMade: job.attemptsMade,
  };
}

export async function closeQueue() {
  if (worker) await worker.close();
  if (executionQueue) await executionQueue.close();
  if (connection) {
    connection.disconnect();
  }
}
