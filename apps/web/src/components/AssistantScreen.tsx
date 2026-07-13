import { useState, type FormEvent } from 'react';
import type { DiagnosisResult } from '@aapsd/contracts';
import './AssistantScreen.css';

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
  const devProjectId =
    import.meta.env.VITE_DEV_PROJECT_ID ?? '00000000-0000-0000-0000-000000000002';
  const devEnvId = import.meta.env.VITE_DEV_ENV_ID ?? '00000000-0000-0000-0000-000000000003';

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
        throw new Error(errBody.error ?? `Request failed (${response.status})`);
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
    <section className="assistant">
      <div className="assistant__badge">Read-Only Analysis</div>
      <h1 className="assistant__title">Diagnosis Assistant</h1>
      <p className="assistant__subtitle">
        Ask a natural-language question about your pipeline, infrastructure, or deployment.
      </p>

      <form className="assistant__form" onSubmit={handleSubmit}>
        <label className="assistant__field">
          <span>What would you like to diagnose?</span>
          <textarea
            className="assistant__textarea"
            rows={3}
            placeholder="e.g. Why did the latest staging deployment fail?"
            value={form.query}
            onChange={(e) => updateField('query', e.target.value)}
            required
          />
        </label>

        <div className="assistant__row">
          <label className="assistant__field">
            <span>Pipeline Run ID (optional)</span>
            <input
              type="text"
              placeholder="e.g. 12345678"
              value={form.pipelineRunId}
              onChange={(e) => updateField('pipelineRunId', e.target.value)}
            />
          </label>
          <label className="assistant__field">
            <span>Pod Name (optional)</span>
            <input
              type="text"
              placeholder="e.g. api-5d8f7c9b6c-abcde"
              value={form.podName}
              onChange={(e) => updateField('podName', e.target.value)}
            />
          </label>
        </div>

        <fieldset className="assistant__fieldset">
          <legend>Time Range (optional)</legend>
          <div className="assistant__row">
            <label className="assistant__field">
              <span>Start</span>
              <input
                type="datetime-local"
                value={form.timeRangeStart}
                onChange={(e) => updateField('timeRangeStart', e.target.value)}
              />
            </label>
            <label className="assistant__field">
              <span>End</span>
              <input
                type="datetime-local"
                value={form.timeRangeEnd}
                onChange={(e) => updateField('timeRangeEnd', e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <button
          className="assistant__submit"
          type="submit"
          disabled={viewState === 'loading' || !form.query.trim()}
        >
          {viewState === 'loading' ? 'Analyzing…' : 'Analyze'}
        </button>
      </form>

      {viewState === 'loading' && (
        <div className="assistant__loading" role="status">
          <div className="assistant__spinner" />
          <p>Running diagnosis — this may take a moment.</p>
        </div>
      )}

      {viewState === 'error' && (
        <div className="assistant__error" role="alert">
          <p className="assistant__error-title">Diagnosis failed</p>
          <p>{errorMessage}</p>
          <button className="assistant__retry" onClick={handleSubmit}>
            Retry
          </button>
        </div>
      )}

      {viewState === 'success' && result && (
        <div className="assistant__result">
          <div className="assistant__result-header">
            <h2>Diagnosis Result</h2>
            <span className={`assistant__confidence assistant__confidence--${result.confidence}`}>
              {confidenceLabel(result.confidence)}
            </span>
          </div>

          <section className="assistant__section">
            <h3>Summary</h3>
            <p>{result.summary}</p>
          </section>

          {result.evidence.length > 0 && (
            <section className="assistant__section">
              <h3>Evidence ({result.evidence.length})</h3>
              <ul className="assistant__evidence-list">
                {result.evidence.map((item, i) => (
                  <li key={i} className="assistant__evidence-item">
                    <span className="assistant__evidence-source">{item.source}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        View source
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.likely_causes.length > 0 && (
            <section className="assistant__section">
              <h3>Likely Causes</h3>
              <ul className="assistant__causes-list">
                {result.likely_causes.map((cause, i) => (
                  <li key={i} className="assistant__cause-item">
                    <span className="assistant__cause-probability">
                      {probabilityLabel(cause.probability)}
                    </span>
                    <span>{cause.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.recommendations.length > 0 && (
            <section className="assistant__section">
              <h3>Recommendations</h3>
              <ol className="assistant__recommendations-list">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="assistant__recommendation-item">
                    <strong>{rec.action}</strong>
                    <p>{rec.details}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {result.redacted && (
            <p className="assistant__redacted-note">
              Sensitive information has been redacted from the evidence shown here.
            </p>
          )}

          <button className="assistant__new-query" onClick={handleReset}>
            New Query
          </button>
        </div>
      )}
    </section>
  );
}
