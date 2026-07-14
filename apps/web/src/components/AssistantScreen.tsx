import { useState, useEffect, type FormEvent } from 'react';
import type { DiagnosisResult } from '@aapsd/contracts';

type ViewState = 'form' | 'loading' | 'success' | 'error';

interface FormData {
  query: string;
  pipelineRunId: string;
  podName: string;
  timeRangeStart: string;
  timeRangeEnd: string;
}

const EMPTY_FORM: FormData = {
  query: '',
  pipelineRunId: '',
  podName: '',
  timeRangeStart: '',
  timeRangeEnd: '',
};

function confidenceLabel(value: string): string {
  const map: Record<string, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    insufficient_evidence: 'Insufficient Evidence',
  };
  return map[value] ?? value;
}

function probabilityLabel(value: number): string {
  if (value >= 0.8) return 'Very Likely';
  if (value >= 0.6) return 'Likely';
  if (value >= 0.3) return 'Possible';
  return 'Unlikely';
}

export default function AssistantScreen() {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [viewState, setViewState] = useState<ViewState>('form');
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
  const devUserId = import.meta.env.VITE_DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001';
  const devRole = import.meta.env.VITE_DEV_ROLE ?? 'viewer';
  const devProjectId = import.meta.env.VITE_DEV_PROJECT_ID ?? '00000000-0000-0000-0000-000000000002';
  const devEnvId = import.meta.env.VITE_DEV_ENV_ID ?? '00000000-0000-0000-0000-000000000003';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const runId = params.get('pipeline_run_id');
    if (runId) {
      setForm((prev) => ({ ...prev, pipelineRunId: runId, query: 'Why did this pipeline fail?' }));
    }
  }, []);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setViewState('loading');
    setErrorMessage('');

    const body: Record<string, unknown> = {
      projectId: devProjectId,
      environmentId: devEnvId,
      query: form.query,
    };

    const context: Record<string, unknown> = {};
    if (form.pipelineRunId) context.pipelineRunId = form.pipelineRunId;
    if (form.podName) context.podName = form.podName;
    if (form.timeRangeStart && form.timeRangeEnd) {
      context.timeRange = { start: form.timeRangeStart, end: form.timeRangeEnd };
    }
    if (Object.keys(context).length > 0) body.context = context;

    try {
      const response = await fetch(`${apiUrl}/api/v1/diagnoses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dev-User-Id': devUserId,
          'X-Dev-Role': devRole,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.details ?? errBody.error ?? `Request failed (${response.status})`);
      }

      const data = (await response.json()) as DiagnosisResult;
      setResult(data);
      setViewState('success');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
      setViewState('error');
    }
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setResult(null);
    setErrorMessage('');
    setViewState('form');
  }

  return (
    <div className="max-w-4xl mx-auto animate-slide-in">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-white tracking-wide">Smart Diagnosis</h1>
        <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-brand-primary/10 text-brand-primary border border-brand-primary/30 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.2)]">
          Read-Only AI
        </span>
      </div>
      <p className="text-brand-muted text-lg mb-8">
        Ask a natural-language question about your pipeline, infrastructure, or deployment.
      </p>

      {viewState === 'form' && (
        <form
          className="glass-panel p-6 md:p-8 rounded-2xl border-brand-primary/20 space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium text-brand-primary uppercase tracking-wider">
              What would you like to diagnose?
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-primary to-blue-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <textarea
                className="relative w-full bg-brand-dark/80 border border-brand-border rounded-xl px-4 py-3 text-white placeholder-brand-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary resize-none transition-all"
                rows={4}
                placeholder="e.g. Why did the latest staging deployment fail?"
                value={form.query}
                onChange={(e) => updateField('query', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-brand-muted">
                Pipeline Run ID (optional)
              </label>
              <input
                type="text"
                className="w-full bg-brand-surfaceHover border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted/50 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                placeholder="e.g. 12345678"
                value={form.pipelineRunId}
                onChange={(e) => updateField('pipelineRunId', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-brand-muted">
                Pod Name (optional)
              </label>
              <input
                type="text"
                className="w-full bg-brand-surfaceHover border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted/50 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                placeholder="e.g. api-5d8f7c9b6c-abcde"
                value={form.podName}
                onChange={(e) => updateField('podName', e.target.value)}
              />
            </div>
          </div>

          <div className="bg-brand-surfaceHover/50 border border-brand-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-brand-muted mb-4 uppercase tracking-wider">
              Time Range (optional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-brand-muted mb-1">Start</label>
                <input
                  type="datetime-local"
                  className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-brand-text focus:outline-none focus:border-brand-primary"
                  value={form.timeRangeStart}
                  onChange={(e) => updateField('timeRangeStart', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-brand-muted mb-1">End</label>
                <input
                  type="datetime-local"
                  className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-brand-text focus:outline-none focus:border-brand-primary"
                  value={form.timeRangeEnd}
                  onChange={(e) => updateField('timeRangeEnd', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={!form.query.trim()}
              className="px-8 py-3 bg-brand-primary text-brand-dark font-bold rounded-lg hover:bg-brand-primaryHover transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,240,255,0.4)]"
            >
              Analyze with Deepseek AI
            </button>
          </div>
        </form>
      )}

      {viewState === 'loading' && (
        <div className="glass-panel p-12 rounded-2xl border-brand-primary/20 flex flex-col items-center justify-center space-y-6">
          <div className="w-16 h-16 border-4 border-brand-border border-t-brand-primary rounded-full animate-spin shadow-[0_0_15px_rgba(0,240,255,0.5)]"></div>
          <p className="text-xl text-white font-medium animate-pulse">Running smart diagnosis...</p>
          <p className="text-brand-muted text-center max-w-sm">
            Fetching logs and metrics, analyzing with Deepseek LLM. This may take a moment.
          </p>
        </div>
      )}

      {viewState === 'error' && (
        <div className="glass-panel p-8 rounded-2xl border-brand-danger/30 bg-brand-danger/5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-danger/20 text-brand-danger rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Diagnosis Failed</h3>
              <p className="text-brand-muted mb-6">{errorMessage}</p>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-brand-surfaceHover border border-brand-border text-white rounded-lg hover:border-brand-muted transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {viewState === 'success' && result && (
        <div className="space-y-6 animate-fade-in">
          <div className="glass-panel p-8 rounded-2xl border-brand-primary/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary shadow-[0_0_10px_rgba(0,240,255,0.8)]"></div>

            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <svg
                  className="w-6 h-6 text-brand-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Diagnosis Result
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-brand-muted uppercase tracking-wider">
                  Confidence:
                </span>
                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full ${
                    result.confidence === 'high'
                      ? 'bg-brand-success/20 text-brand-success border border-brand-success/30'
                      : result.confidence === 'medium'
                        ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                        : 'bg-brand-danger/20 text-brand-danger border border-brand-danger/30'
                  }`}
                >
                  {confidenceLabel(result.confidence)}
                </span>
              </div>
            </div>

            <div className="prose prose-invert max-w-none mb-8">
              <p className="text-lg text-brand-text leading-relaxed">{result.summary}</p>
            </div>

            {result.likely_causes.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-4 border-b border-brand-border pb-2">
                  Likely Causes
                </h3>
                <div className="space-y-3">
                  {result.likely_causes.map((cause, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-4 p-4 rounded-xl bg-brand-surfaceHover/50 border border-brand-border hover:border-brand-primary/30 transition-colors"
                    >
                      <span className="px-2.5 py-1 text-xs font-bold bg-brand-dark border border-brand-border rounded text-brand-primary whitespace-nowrap">
                        {probabilityLabel(cause.probability)}
                      </span>
                      <span className="text-brand-text">{cause.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-4 border-b border-brand-border pb-2">
                  Recommended Actions
                </h3>
                <div className="space-y-4">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="pl-4 border-l-2 border-brand-primary">
                      <h4 className="text-white font-medium text-lg mb-1">{rec.action}</h4>
                      <p className="text-brand-muted">{rec.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.evidence.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-4 border-b border-brand-border pb-2">
                  Supporting Evidence
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.evidence.map((item, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-brand-surfaceHover/30 border border-brand-border"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-dark text-brand-muted uppercase">
                          {item.source}
                        </span>
                      </div>
                      <h4 className="text-white font-medium mb-1 truncate">{item.title}</h4>
                      <p className="text-sm text-brand-muted line-clamp-2 mb-3">{item.detail}</p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-primary text-sm hover:underline flex items-center gap-1"
                        >
                          View details
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.redacted && (
              <div className="flex items-center gap-2 mt-8 text-xs text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Sensitive information has been redacted from the evidence shown here.
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="px-6 py-3 glass-panel text-white font-medium rounded-lg hover:border-brand-primary transition-all flex items-center gap-2"
            >
              <svg
                className="w-5 h-5 text-brand-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Start New Diagnosis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
