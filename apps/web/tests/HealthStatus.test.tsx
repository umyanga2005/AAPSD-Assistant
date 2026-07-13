import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HealthStatus from '../src/components/HealthStatus.js';

describe('HealthStatus', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows connecting state initially', () => {
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) =>
          setTimeout(() => resolve(new Response(null, { status: 200 })), 10_000),
        ),
    );

    render(<HealthStatus />);
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('shows connected when API responds with 200', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    render(<HealthStatus />);
    expect(await screen.findByText('Connected')).toBeInTheDocument();
  });

  it('shows disconnected when API responds with error', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));

    render(<HealthStatus />);
    expect(await screen.findByText('Disconnected')).toBeInTheDocument();
  });

  it('shows disconnected when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<HealthStatus />);
    expect(await screen.findByText('Disconnected')).toBeInTheDocument();
  });
});
