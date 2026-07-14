import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import InfrastructurePage from '../src/components/InfrastructurePage.js';

describe('InfrastructurePage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://test-api');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('shows loading state on mount', () => {
    global.fetch = vi.fn(() => new Promise<never>(() => {}));
    render(<InfrastructurePage />);
    expect(screen.getByText('Loading infrastructure data...')).toBeInTheDocument();
  });

  const mockData = {
    deployments: [
      { name: 'api', namespace: 'default', replicas: 2, availableReplicas: 2 },
      { name: 'worker', namespace: 'default', replicas: 1, availableReplicas: 1 },
      { name: 'db', namespace: 'default', replicas: 1, availableReplicas: 0 },
      { name: 'cache', namespace: 'default', replicas: 3, availableReplicas: 3 },
    ],
    pods: [
      {
        name: 'api-1',
        namespace: 'default',
        phase: 'Running',
        containers: [{ name: 'api', restartCount: 0, ready: true, state: 'Running' }],
      },
      {
        name: 'api-2',
        namespace: 'default',
        phase: 'Running',
        containers: [{ name: 'api', restartCount: 1, ready: true, state: 'Running' }],
      },
      {
        name: 'worker-1',
        namespace: 'default',
        phase: 'CrashLoopBackOff',
        containers: [{ name: 'worker', restartCount: 10, ready: false, state: 'Waiting' }],
      },
      {
        name: 'db-1',
        namespace: 'default',
        phase: 'Pending',
        containers: [{ name: 'db', restartCount: 0, ready: false, state: 'Waiting' }],
      },
    ],
  };

  it('shows error state when API call fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<InfrastructurePage />);

    expect(await screen.findByText('Infrastructure')).toBeInTheDocument();
    expect(await screen.findByText(/Failed to load infrastructure data/)).toBeInTheDocument();
  });

  it('renders summary cards', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) });

    render(<InfrastructurePage />);

    expect((await screen.findAllByText(/Deployments/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Healthy/i)).length).toBeGreaterThan(0);
  });

  it('renders pod status with restart counts', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) });

    render(<InfrastructurePage />);

    expect(await screen.findByText('CrashLoopBackOff')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders deployment health statuses', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) });

    render(<InfrastructurePage />);

    const healthyStatuses = await screen.findAllByText(/healthy/i);
    expect(healthyStatuses.length).toBeGreaterThan(0);
    expect(await screen.findByText('degraded')).toBeInTheDocument();
  });

  it('shows empty state when there is no data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    });

    render(<InfrastructurePage />);

    expect(await screen.findByText('No infrastructure data available.')).toBeInTheDocument();
  });
});
