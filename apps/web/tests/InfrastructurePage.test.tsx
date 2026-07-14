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
      { name: 'api', namespace: 'default', replicas: 2, availableReplicas: 2, status: 'healthy' },
      { name: 'worker', namespace: 'default', replicas: 1, availableReplicas: 1, status: 'healthy' },
      { name: 'db', namespace: 'default', replicas: 1, availableReplicas: 0, status: 'degraded' },
      { name: 'cache', namespace: 'default', replicas: 3, availableReplicas: 3, status: 'healthy' }
    ],
    pods: [
      { name: 'api-1', namespace: 'default', status: 'Running', restarts: 0, cpuUsage: '100m', memoryUsage: '128Mi' },
      { name: 'api-2', namespace: 'default', status: 'Running', restarts: 1, cpuUsage: '120m', memoryUsage: '140Mi' },
      { name: 'worker-1', namespace: 'default', status: 'CrashLoopBackOff', restarts: 10, cpuUsage: '0m', memoryUsage: '0Mi' },
      { name: 'db-1', namespace: 'default', status: 'Pending', restarts: 0, cpuUsage: '0m', memoryUsage: '0Mi' }
    ]
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
