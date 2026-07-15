import { vi } from 'vitest';

vi.mock('../src/services/job-queue.js', () => ({
  initQueue: vi.fn(),
  closeQueue: vi.fn(),
  enqueueActionExecution: vi.fn().mockResolvedValue('mock-job-id'),
  getJobStatus: vi.fn().mockResolvedValue({ id: 'mock-job-id', state: 'completed' }),
}));
