import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AssistantScreen from '../src/components/AssistantScreen.js';

const MOCK_RESULT = {
  requestId: 'req-001',
  summary: 'The staging deployment failed because the database migration timed out.',
  evidence: [
    {
      source: 'pipeline_logs',
      title: 'Migration timeout',
      detail: 'Migration 042_add_index ran for 30s and timed out.',
    },
  ],
  likely_causes: [{ description: 'Large table without index', probability: 0.85 }],
  recommendations: [
    {
      action: 'Add index before migration',
      details: 'Create a separate deploy step to add the index first.',
    },
  ],
  confidence: 'medium',
  needs_human_review: false,
  redacted: false,
  traceId: 'trace-001',
};

function typeInto(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } });
}

describe('AssistantScreen', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://test-api');
    vi.stubEnv('VITE_DEV_USER_ID', 'test-user-id');
    vi.stubEnv('VITE_DEV_ROLE', 'admin');
    vi.stubEnv('VITE_DEV_PROJECT_ID', 'test-project-id');
    vi.stubEnv('VITE_DEV_ENV_ID', 'test-env-id');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders the read-only badge and form', () => {
    render(<AssistantScreen />);
    expect(screen.getByText('Read-Only AI')).toBeInTheDocument();
    expect(screen.getByText('Smart Diagnosis')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/why did the latest/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
  });

  it('submit button is disabled when query is empty', () => {
    render(<AssistantScreen />);
    expect(screen.getByRole('button', { name: /analyze/i })).toBeDisabled();
  });

  it('shows loading state on submit', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      return new Promise<never>(() => {});
    });

    render(<AssistantScreen />);

    const textarea = screen.getByPlaceholderText(/why did the latest/i);
    typeInto(textarea, 'Why did the build fail?');
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText(/running smart diagnosis/i)).toBeInTheDocument();
  });

  it('shows diagnosis result on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESULT),
    });

    render(<AssistantScreen />);

    typeInto(screen.getByPlaceholderText(/why did the latest/i), 'Why did the deployment fail?');
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText('Diagnosis Result')).toBeInTheDocument();
    expect(await screen.findByText(MOCK_RESULT.summary)).toBeInTheDocument();
    expect(await screen.findByText('Medium')).toBeInTheDocument();
    expect(await screen.findByText(MOCK_RESULT.evidence[0].title)).toBeInTheDocument();
    expect(await screen.findByText(MOCK_RESULT.likely_causes[0].description)).toBeInTheDocument();
    expect(await screen.findByText(MOCK_RESULT.recommendations[0].action)).toBeInTheDocument();
    expect(await screen.findByText(/Start New Diagnosis/i)).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Validation failed' }),
    });

    render(<AssistantScreen />);

    typeInto(screen.getByPlaceholderText(/why did the latest/i), 'Why did it fail?');
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText('Diagnosis Failed')).toBeInTheDocument();
    expect(await screen.findByText('Validation failed')).toBeInTheDocument();
    expect(await screen.findByText('Try Again')).toBeInTheDocument();
  });

  it('retry button re-submits on failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_RESULT),
      });

    global.fetch = fetchMock;

    render(<AssistantScreen />);

    typeInto(screen.getByPlaceholderText(/why did the latest/i), 'Why did it fail?');
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    expect(await screen.findByText('Server error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText(MOCK_RESULT.summary)).toBeInTheDocument();
  });

  it('new query button resets to form', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESULT),
    });

    render(<AssistantScreen />);

    typeInto(screen.getByPlaceholderText(/why did the latest/i), 'Why did it fail?');
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    expect(await screen.findByText('Diagnosis Result')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /start new diagnosis/i }));
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
    expect(screen.queryByText('Diagnosis Result')).not.toBeInTheDocument();
  });
});
