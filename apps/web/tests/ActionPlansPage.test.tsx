import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActionPlansPage from '../src/components/ActionPlansPage.js';

vi.mock('../src/api.js', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '../src/api.js';

describe('ActionPlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(fetchWithAuth).mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<ActionPlansPage />);
    expect(screen.getByText('Governed Actions')).toBeInTheDocument();
  });

  it('renders empty list if no plans', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<ActionPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('No action plans found.')).toBeInTheDocument();
    });
  });

  it('renders plans and allows selection', async () => {
    const mockPlans = [
      {
        id: 'plan-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        actionType: 'kubernetes.deployment.restart',
        typedArgs: { namespace: 'staging', deploymentName: 'api' },
        status: 'pending',
        actorId: 'usr-1',
        approverId: null,
        policyResult: { allowed: true, environmentName: 'staging' },
        traceId: 'tr-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.mocked(fetchWithAuth).mockResolvedValue({
      ok: true,
      json: async () => mockPlans,
    } as Response);

    render(<ActionPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('kubernetes.deployment.restart')).toBeInTheDocument();
    });

    // Select the plan
    fireEvent.click(screen.getByText('kubernetes.deployment.restart'));

    // Check if details are shown
    await waitFor(() => {
      expect(screen.getByText(/Plan Preview/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Awaiting Approval/i).length).toBeGreaterThan(0);
    });
  });

  it('handles create action plan', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    render(<ActionPlansPage />);

    await waitFor(() => {
      expect(screen.getByText('Request Action')).toBeInTheDocument();
    });

    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-plan', status: 'pending' }),
    } as Response);

    // Mock reload
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    fireEvent.click(screen.getByText('Create Action Plan'));

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining('/api/action-plans'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });
});
