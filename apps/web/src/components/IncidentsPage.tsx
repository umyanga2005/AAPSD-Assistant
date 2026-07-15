import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../api.js';

interface Incident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'investigating' | 'resolved';
  createdAt: string;
  description: string;
  impactedComponent: string;
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

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'text-brand-danger bg-brand-danger/10 border-brand-danger/30';
    case 'high':
      return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
    case 'medium':
      return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    case 'low':
      return 'text-brand-success bg-brand-success/10 border-brand-success/30';
    default:
      return 'text-brand-muted bg-brand-surfaceHover border-brand-border';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return "text-brand-danger flex items-center gap-2 before:content-[''] before:block before:w-2 before:h-2 before:rounded-full before:bg-brand-danger before:animate-pulse";
    case 'investigating':
      return "text-brand-primary flex items-center gap-2 before:content-[''] before:block before:w-2 before:h-2 before:rounded-full before:bg-brand-primary";
    case 'resolved':
      return "text-brand-muted flex items-center gap-2 before:content-[''] before:block before:w-2 before:h-2 before:rounded-full before:bg-brand-success";
    default:
      return 'text-brand-muted';
  }
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetchWithAuth(`${apiUrl}/api/incidents`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!cancelled) {
          setIncidents(data);
          setViewState('success');
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setViewState('error');
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return (
    <div className="max-w-5xl mx-auto animate-slide-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white tracking-wide">Incidents</h1>
            <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-brand-danger/10 text-brand-danger border border-brand-danger/30 rounded-full shadow-[0_0_10px_rgba(255,51,102,0.2)]">
              {incidents.filter((i) => i.status !== 'resolved').length} Active
            </span>
          </div>
          <p className="text-brand-muted text-lg">
            Active and resolved incident timeline based on system events.
          </p>
        </div>
      </div>

      {viewState === 'loading' && (
        <div className="glass-panel p-12 rounded-2xl border-brand-primary/20 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-brand-border border-t-brand-primary rounded-full animate-spin"></div>
          <p className="text-brand-muted">Loading incidents...</p>
        </div>
      )}

      {viewState === 'error' && (
        <div className="glass-panel p-8 rounded-2xl border-brand-danger/30 bg-brand-danger/5 text-center">
          <p className="text-xl font-bold text-white mb-2">Failed to load incidents</p>
          <p className="text-brand-muted">Please check your network connection and try again.</p>
        </div>
      )}

      {viewState === 'success' && incidents.length === 0 && (
        <div className="glass-panel p-12 rounded-2xl border-brand-border text-center">
          <p className="text-brand-muted text-lg">No incidents recorded yet.</p>
        </div>
      )}

      {viewState === 'success' && incidents.length > 0 && (
        <div className="space-y-6 relative before:content-[''] before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-brand-border before:z-0">
          {incidents.map((incident) => (
            <div key={incident.id} className="relative z-10 flex gap-6 group">
              {/* Timeline dot */}
              <div
                className={`mt-1.5 flex-none w-10 h-10 rounded-full border-4 border-brand-dark flex items-center justify-center transition-colors ${
                  incident.status === 'resolved'
                    ? 'bg-brand-surfaceHover text-brand-success'
                    : incident.status === 'active'
                      ? 'bg-brand-danger text-white shadow-[0_0_15px_rgba(255,51,102,0.4)]'
                      : 'bg-brand-primary text-brand-dark shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                }`}
              >
                {incident.status === 'resolved' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
              </div>

              {/* Content card */}
              <div
                className={`flex-1 glass-panel p-6 rounded-2xl border transition-all duration-300 ${
                  incident.status === 'active'
                    ? 'border-brand-danger/30 hover:border-brand-danger/60 bg-brand-danger/5'
                    : incident.status === 'investigating'
                      ? 'border-brand-primary/30 hover:border-brand-primary/60 bg-brand-primary/5'
                      : 'border-brand-border hover:border-brand-primary/20'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-bold text-white group-hover:text-brand-primary transition-colors">
                        {incident.title}
                      </h2>
                      <span
                        className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border ${getSeverityColor(incident.severity)}`}
                      >
                        {incident.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium">
                      <span className={getStatusColor(incident.status)}>
                        {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                      </span>
                      <span className="text-brand-muted">•</span>
                      <span className="text-brand-muted font-mono">
                        {formatDate(incident.createdAt)}
                      </span>
                    </div>
                  </div>

                  {incident.status !== 'resolved' && (
                    <button className="px-4 py-2 bg-brand-surfaceHover border border-brand-primary/30 text-brand-primary rounded-lg font-medium hover:bg-brand-primary hover:text-brand-dark transition-colors whitespace-nowrap">
                      Investigate
                    </button>
                  )}
                </div>

                <p className="text-brand-muted text-base leading-relaxed mb-4">
                  {incident.description}
                </p>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white/50">Impacted Component:</span>
                  <span className="text-sm font-mono text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/20">
                    {incident.impactedComponent}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
