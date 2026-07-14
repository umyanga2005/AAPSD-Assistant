import { useEffect, useState } from 'react';

interface AuditEvent {
  id: string;
  actorId: string;
  projectId: string;
  eventType: string;
  traceId: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const MOCK_EVENTS: AuditEvent[] = [
  {
    id: 'evt-1',
    actorId: 'usr-admin-1',
    projectId: 'proj-1',
    eventType: 'deployment.triggered',
    traceId: 'tr-abc-123',
    targetType: 'deployment',
    targetId: 'backend-api',
    metadata: { environment: 'production', tag: 'v1.2.0' },
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'evt-2',
    actorId: 'usr-dev-2',
    projectId: 'proj-1',
    eventType: 'diagnosis.requested',
    traceId: 'tr-def-456',
    targetType: 'pipeline_run',
    targetId: 'run-86980652867',
    metadata: { reason: 'Investigating build failure' },
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'evt-3',
    actorId: 'usr-system',
    projectId: 'proj-1',
    eventType: 'infrastructure.scaled',
    traceId: 'tr-ghi-789',
    targetType: 'pod',
    targetId: 'frontend-web',
    metadata: { replicas: 3, trigger: 'cpu_threshold_exceeded' },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

type ViewState = 'loading' | 'success' | 'error';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getEventColor(type: string) {
  if (type.includes('fail') || type.includes('error') || type.includes('delete'))
    return 'text-brand-danger bg-brand-danger/10 border-brand-danger/30';
  if (type.includes('success') || type.includes('approve') || type.includes('create'))
    return 'text-brand-success bg-brand-success/10 border-brand-success/30';
  if (type.includes('scale') || type.includes('update') || type.includes('trigger'))
    return 'text-brand-primary bg-brand-primary/10 border-brand-primary/30';
  return 'text-brand-muted bg-brand-surfaceHover border-brand-border';
}

export default function AuditLogsPage() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [events, setEvents] = useState<AuditEvent[]>([]);

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setViewState('loading');
      try {
        // Attempt to fetch from API. Need to provide dummy project_id and user headers.
        const response = await fetch(`${apiUrl}/api/audit-events?project_id=mock-project-1`, {
          headers: {
            'X-Dev-User-Id': '00000000-0000-0000-0000-000000000001',
            'X-Dev-Role': 'administrator',
          },
        });

        if (!response.ok) {
          throw new Error('Fallback to mock');
        }

        const body = (await response.json()) as AuditEvent[];
        if (cancelled) return;

        if (body.length > 0) {
          setEvents(body);
        } else {
          setEvents(MOCK_EVENTS);
        }
        setViewState('success');
      } catch {
        if (cancelled) return;
        setEvents(MOCK_EVENTS);
        setViewState('success');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return (
    <div className="max-w-7xl mx-auto animate-slide-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white tracking-wide">Audit Log</h1>
            <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-brand-primary/10 text-brand-primary border border-brand-primary/30 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              Compliance
            </span>
          </div>
          <p className="text-brand-muted text-lg">
            Immutable record of all system events, manual actions, and AI diagnoses.
          </p>
        </div>
      </div>

      {viewState === 'loading' && (
        <div className="glass-panel p-12 rounded-2xl border-brand-primary/20 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-brand-border border-t-brand-primary rounded-full animate-spin"></div>
          <p className="text-brand-muted">Loading audit events...</p>
        </div>
      )}

      {viewState === 'success' && (
        <div className="glass-panel rounded-xl border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-brand-border bg-brand-surfaceHover/50">
                  <th className="px-6 py-4 text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    Event Type
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    Actor ID
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    Trace ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-brand-surfaceHover transition-colors group">
                    <td className="px-6 py-4 text-sm text-brand-muted whitespace-nowrap">
                      {formatDate(evt.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-md border ${getEventColor(evt.eventType)}`}
                      >
                        {evt.eventType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{evt.targetId}</span>
                        <span className="text-xs text-brand-muted">({evt.targetType})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-brand-muted font-mono">{evt.actorId}</td>
                    <td className="px-6 py-4 text-sm text-brand-muted font-mono">
                      <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
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
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                        {evt.traceId}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
