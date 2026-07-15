import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../api.js';

interface PipelineRun {
  id: string;
  workflowName: string;
  status: 'success' | 'failed' | 'running' | 'pending';
  branch: string;
  commitSha: string;
  repo: string;
  duration: string;
  triggeredAt: string;
  failedJobs: { name: string; step: string; exitCode: number }[];
}

interface ApiPipelineRun {
  id: string | number;
  workflow_name?: string;
  name?: string;
  status?: string;
  conclusion?: string;
  branch?: string;
  commit_sha?: string;
  head_sha?: string;
  repo?: string;
  duration?: string;
  triggered_at?: string;
  createdAt?: string;
  failed_jobs?: { name: string; step: string; exit_code: number }[];
}

function normalizeRun(raw: ApiPipelineRun): PipelineRun {
  let normalizedStatus = raw.status;
  if (raw.status === 'completed' && raw.conclusion) {
    normalizedStatus = raw.conclusion;
  }
  if (normalizedStatus === 'failure') normalizedStatus = 'failed';

  return {
    id: String(raw.id),
    workflowName: raw.workflow_name || raw.name || 'Unknown Workflow',
    status: (normalizedStatus || 'pending') as PipelineRun['status'],
    branch: raw.branch || 'main',
    commitSha: raw.commit_sha || raw.head_sha || '0000000',
    repo: raw.repo || 'Unknown Repo',
    duration: raw.duration || '0s',
    triggeredAt: raw.triggered_at || raw.createdAt || new Date().toISOString(),
    failedJobs: (raw.failed_jobs ?? []).map((j) => ({
      name: j.name,
      step: j.step,
      exitCode: j.exit_code,
    })),
  };
}

function statusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

type ViewState = 'loading' | 'success' | 'error';

export default function PipelinesPage() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [pipelines, setPipelines] = useState<PipelineRun[]>([]);
  const [repos, setRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [page, setPage] = useState(1);

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

  useEffect(() => {
    let cancelled = false;

    async function loadRepos() {
      try {
        const res = await fetchWithAuth(`${apiUrl}/api/github/repos`);
        if (res.ok) {
          const body = await res.json();
          if (!cancelled && body.repos) {
            setRepos(body.repos);
          }
        }
      } catch (err) {
        console.error('Failed to load repos', err);
        if (!cancelled) {
          setRepos([]);
        }
      }
    }
    loadRepos();

    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setViewState('loading');
      try {
        const queryParams = new URLSearchParams();
        if (selectedRepo) queryParams.append('repo', selectedRepo);
        queryParams.append('page', page.toString());
        queryParams.append('limit', '10');

        const response = await fetchWithAuth(`${apiUrl}/api/pipelines?${queryParams.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { data: ApiPipelineRun[] };
        if (cancelled) return;
        const normalized = (body.data ?? []).map(normalizeRun);
        setPipelines(normalized);
        setViewState('success');
      } catch {
        if (cancelled) return;
        setPipelines([]);
        setViewState('success');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, selectedRepo, page]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-brand-success bg-brand-success/10 border-brand-success/30';
      case 'failed':
        return 'text-brand-danger bg-brand-danger/10 border-brand-danger/30';
      case 'running':
        return 'text-brand-primary bg-brand-primary/10 border-brand-primary/30 animate-pulse';
      default:
        return 'text-brand-muted bg-brand-surfaceHover border-brand-border';
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-slide-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white tracking-wide">Pipelines</h1>
            <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-brand-primary/10 text-brand-primary border border-brand-primary/30 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              Read-Only View
            </span>
          </div>
          <p className="text-brand-muted text-lg">
            Workflow runs, status, duration, and failed job summaries.
          </p>
        </div>

        {repos.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-brand-muted text-sm font-medium">Repository:</label>
            <select
              value={selectedRepo}
              onChange={(e) => {
                setSelectedRepo(e.target.value);
                setPage(1);
              }}
              className="bg-brand-dark/50 border border-brand-primary/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-primary transition-all"
            >
              <option value="">All tracked (first available)</option>
              {repos.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {viewState === 'loading' && (
        <div className="glass-panel p-12 rounded-2xl border-brand-primary/20 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-brand-border border-t-brand-primary rounded-full animate-spin"></div>
          <p className="text-brand-muted">Loading pipeline runs...</p>
        </div>
      )}

      {viewState === 'error' && (
        <div className="glass-panel p-8 rounded-2xl border-brand-danger/30 bg-brand-danger/5 text-center">
          <p className="text-xl font-bold text-white mb-2">Failed to load pipelines</p>
          <p className="text-brand-muted">Please check your network connection and try again.</p>
        </div>
      )}

      {viewState === 'success' && pipelines.length === 0 && repos.length === 0 && (
        <div className="glass-panel p-12 rounded-2xl border-brand-primary/30 bg-brand-primary/5 text-center">
          <p className="text-brand-primary text-xl font-bold mb-2">GitHub Not Connected</p>
          <p className="text-brand-muted text-lg mb-6">
            Please connect your GitHub account in the Settings to view your pipelines.
          </p>
          <a
            href="/settings"
            className="inline-block px-6 py-3 bg-brand-primary text-brand-dark font-bold rounded-lg hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all"
          >
            Go to Settings
          </a>
        </div>
      )}

      {viewState === 'success' && pipelines.length === 0 && repos.length > 0 && (
        <div className="glass-panel p-12 rounded-2xl border-brand-border text-center">
          <p className="text-brand-muted text-lg">No pipeline runs found for this repository.</p>
        </div>
      )}

      {viewState === 'success' && pipelines.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {pipelines.map((run) => (
            <div
              key={run.id}
              className="glass-panel rounded-xl border-brand-border hover:border-brand-primary/40 transition-all duration-300 overflow-hidden group"
            >
              <div className="p-5 md:p-6 flex flex-col md:flex-row gap-6 md:items-center justify-between">
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white group-hover:text-brand-primary transition-colors">
                      {run.workflowName}
                    </h3>
                    <span
                      className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border ${getStatusColor(run.status)}`}
                    >
                      {statusLabel(run.status)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-brand-muted">
                    <span className="flex items-center gap-1.5 font-medium text-brand-primary/80">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                      {run.repo}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      {run.branch}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono bg-brand-surface px-2 py-0.5 rounded text-brand-text border border-brand-border">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {shortSha(run.commitSha)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {run.duration}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {formatDate(run.triggeredAt)}
                    </span>
                  </div>

                  {run.failedJobs.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {run.failedJobs.map((job, i) => (
                        <div
                          key={i}
                          className="text-sm text-brand-danger/90 bg-brand-danger/10 border border-brand-danger/20 rounded px-3 py-1.5 inline-flex items-center gap-2 mr-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span>
                            {job.name} / {job.step} (exit {job.exitCode})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex md:flex-col items-center justify-end gap-3 md:min-w-[120px]">
                  <a
                    href={`/assistant?pipeline_run_id=${run.id}`}
                    className="w-full text-center px-4 py-2 bg-brand-surfaceHover border border-brand-primary/30 text-brand-primary rounded-lg font-medium hover:bg-brand-primary hover:text-brand-dark transition-colors whitespace-nowrap"
                  >
                    Diagnose
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewState === 'success' && pipelines.length > 0 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-brand-surface border border-brand-border rounded-lg text-white disabled:opacity-50 hover:bg-brand-surfaceHover transition-colors"
          >
            Previous
          </button>
          <span className="text-brand-muted font-medium">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={pipelines.length < 10}
            className="px-4 py-2 bg-brand-surface border border-brand-border rounded-lg text-white disabled:opacity-50 hover:bg-brand-surfaceHover transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
