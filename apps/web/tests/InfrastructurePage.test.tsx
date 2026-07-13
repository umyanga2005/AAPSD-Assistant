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

  it('falls back to mock data when API call fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<InfrastructurePage />);

    expect(await screen.findByText('Infrastructure')).toBeInTheDocument();
    expect(await screen.findByText(/Showing demo data/)).toBeInTheDocument();
    expect(await screen.findByText('api')).toBeInTheDocument();
    expect(await screen.findByText('worker')).toBeInTheDocument();
  });

  it('renders summary cards', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    render(<InfrastructurePage />);

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(await screen.findByText('11')).toBeInTheDocument();
  });

  it('renders pod status with restart counts', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    render(<InfrastructurePage />);

    expect(await screen.findByText('CrashLoopBackOff')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders deployment health statuses', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    render(<InfrastructurePage />);

    const healthyStatuses = await screen.findAllByText('healthy');
    expect(healthyStatuses.length).toBeGreaterThanOrEqual(3);
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
