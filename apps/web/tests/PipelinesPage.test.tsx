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

  it('falls back to mock data when API call fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<PipelinesPage />);

    expect(await screen.findByText('Pipelines')).toBeInTheDocument();
    expect(await screen.findByText(/Showing demo data/)).toBeInTheDocument();
    expect((await screen.findAllByText(/Deploy to Staging/)).length).toBe(2);
    expect(await screen.findByText('CI Checks')).toBeInTheDocument();
  });

  it('renders pipeline status badges', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    render(<PipelinesPage />);

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect((await screen.findAllByText('Success')).length).toBe(2);
    expect(await screen.findByText('Running')).toBeInTheDocument();
    expect(await screen.findByText('Pending')).toBeInTheDocument();
  });

  it('renders failed job summaries', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    render(<PipelinesPage />);

    expect(await screen.findByText(/Pull image/)).toBeInTheDocument();
    expect(await screen.findByText(/exit 1/)).toBeInTheDocument();
  });

  it('renders diagnosis links', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));

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
