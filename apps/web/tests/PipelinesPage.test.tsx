import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PipelinesPage from '../src/components/PipelinesPage.js';

describe('PipelinesPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://test-api');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('shows loading state on mount', () => {
    global.fetch = vi.fn(() => new Promise<never>(() => {}));
    render(<PipelinesPage />);
    expect(screen.getByText('Loading pipeline runs...')).toBeInTheDocument();
  });

  it('shows error state when API call fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<PipelinesPage />);

    expect(await screen.findByText('Pipelines')).toBeInTheDocument();
    expect(await screen.findByText(/No pipeline runs found/)).toBeInTheDocument();
  });

  const mockData = [
    { id: '1', name: 'Deploy to Staging', status: 'failed', conclusion: 'failure', failed_jobs: [{ name: 'Build', step: 'Pull image', exit_code: 1 }] },
    { id: '2', name: 'Deploy to Staging', status: 'completed', conclusion: 'success' },
    { id: '3', name: 'CI Checks', status: 'completed', conclusion: 'success' },
    { id: '4', name: 'Nightly', status: 'in_progress' },
    { id: '5', name: 'Linter', status: 'queued' }
  ];

  it('renders pipeline status badges', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: mockData }) });

    render(<PipelinesPage />);

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect((await screen.findAllByText('Success')).length).toBe(2);
    expect(await screen.findByText('In_progress')).toBeInTheDocument();
    expect(await screen.findByText('Queued')).toBeInTheDocument();
  });

  it('renders failed job summaries', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: mockData }) });

    render(<PipelinesPage />);

    expect(await screen.findByText(/Pull image/)).toBeInTheDocument();
    expect(await screen.findByText(/exit 1/)).toBeInTheDocument();
  });

  it('renders diagnosis links', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: mockData }) });

    render(<PipelinesPage />);

    const links = await screen.findAllByText('Diagnose');
    expect(links.length).toBeGreaterThan(0);
  });

  it('shows empty state when API returns no data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<PipelinesPage />);

    expect(await screen.findByText(/No pipeline runs found/)).toBeInTheDocument();
  });
});
