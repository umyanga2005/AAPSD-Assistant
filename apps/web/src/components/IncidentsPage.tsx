import { useState } from 'react';

interface Incident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'investigating' | 'resolved';
  createdAt: string;
  description: string;
  impactedComponent: string;
}

const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'inc-1',
    title: 'Cluster Node NotReady',
    severity: 'critical',
    status: 'active',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    description:
      'A Kubernetes worker node has transitioned to NotReady state, causing pod evictions.',
    impactedComponent: 'kubernetes-cluster',
  },
  {
    id: 'inc-2',
    title: 'API Latency Spike',
    severity: 'high',
    status: 'investigating',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    description: 'Average response time for /api/v1/diagnoses exceeded 2000ms threshold.',
    impactedComponent: 'backend-api',
  },
  {
    id: 'inc-3',
    title: 'Failed Production Build',
    severity: 'medium',
    status: 'resolved',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    description: 'The automated CI/CD pipeline failed during the test stage due to a timeout.',
    impactedComponent: 'github-actions',
  },
];

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
  const [incidents] = useState<Incident[]>(MOCK_INCIDENTS);

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
    </div>
  );
}
