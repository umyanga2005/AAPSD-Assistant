import { useEffect, useState } from 'react';

interface Deployment {
  name: string;
  namespace: string;
  desired: number;
  available: number;
  status: string;
}

interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  cpu: string;
  memory: string;
}

interface InfrastructureData {
  deployments: Deployment[];
  pods: PodInfo[];
}

const MOCK_DATA: InfrastructureData = {
  deployments: [
    { name: 'api', namespace: 'staging', desired: 3, available: 3, status: 'healthy' },
    { name: 'web', namespace: 'staging', desired: 2, available: 2, status: 'healthy' },
    { name: 'worker', namespace: 'staging', desired: 1, available: 0, status: 'degraded' },
    { name: 'cache', namespace: 'staging', desired: 1, available: 1, status: 'healthy' },
  ],
  pods: [
    {
      name: 'api-5d8f7c9b6c-a1b2c',
      namespace: 'staging',
      status: 'Running',
      restarts: 0,
      cpu: '120m',
      memory: '256Mi',
    },
    {
      name: 'api-5d8f7c9b6c-d3e4f',
      namespace: 'staging',
      status: 'Running',
      restarts: 1,
      cpu: '95m',
      memory: '210Mi',
    },
    {
      name: 'api-5d8f7c9b6c-g5h6i',
      namespace: 'staging',
      status: 'Running',
      restarts: 0,
      cpu: '110m',
      memory: '240Mi',
    },
    {
      name: 'web-2a3b4c5d6e-j7k8l',
      namespace: 'staging',
      status: 'Running',
      restarts: 0,
      cpu: '45m',
      memory: '128Mi',
    },
    {
      name: 'web-2a3b4c5d6e-m9n0o',
      namespace: 'staging',
      status: 'Running',
      restarts: 2,
      cpu: '50m',
      memory: '132Mi',
    },
    {
      name: 'worker-1p2q3r4s5t-u6v7w',
      namespace: 'staging',
      status: 'CrashLoopBackOff',
      restarts: 8,
      cpu: '10m',
      memory: '64Mi',
    },
    {
      name: 'cache-8x9y0z1a2b-c3d4e',
      namespace: 'staging',
      status: 'Running',
      restarts: 0,
      cpu: '30m',
      memory: '96Mi',
    },
  ],
};

type ViewState = 'loading' | 'success' | 'error';

export default function InfrastructurePage() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [data, setData] = useState<InfrastructureData | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setViewState('loading');
      try {
        const response = await fetch(`${apiUrl}/api/infrastructure`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as InfrastructureData;
        if (cancelled) return;
        setData(body);
        setViewState('success');
      } catch {
        if (cancelled) return;
        setData(MOCK_DATA);
        setIsMockData(true);
        setViewState('success');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const totalRestarts = data?.pods.reduce((sum, p) => sum + p.restarts, 0) ?? 0;
  const healthyDeployments = data?.deployments.filter((d) => d.status === 'healthy').length ?? 0;
  const unHealthyPods = data?.pods.filter((p) => p.status !== 'Running').length ?? 0;

  return (
    <div className="max-w-6xl mx-auto animate-slide-in space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white tracking-wide">Infrastructure</h1>
            <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-brand-primary/10 text-brand-primary border border-brand-primary/30 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              Read-Only View
            </span>
          </div>
          <p className="text-brand-muted text-lg">
            Cluster state, pod status, and resource metrics.
          </p>
        </div>

        {isMockData && (
          <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-lg text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Showing demo data
          </div>
        )}
      </div>

      {viewState === 'loading' && (
        <div className="glass-panel p-12 rounded-2xl border-brand-primary/20 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-brand-border border-t-brand-primary rounded-full animate-spin"></div>
          <p className="text-brand-muted">Loading infrastructure data...</p>
        </div>
      )}

      {viewState === 'error' && (
        <div className="glass-panel p-8 rounded-2xl border-brand-danger/30 bg-brand-danger/5 text-center">
          <p className="text-xl font-bold text-white mb-2">Failed to load infrastructure data</p>
          <p className="text-brand-muted">Please check your network connection and try again.</p>
        </div>
      )}

      {viewState === 'success' && !data && (
        <div className="glass-panel p-12 rounded-2xl border-brand-border text-center">
          <p className="text-brand-muted text-lg">No infrastructure data available.</p>
        </div>
      )}

      {viewState === 'success' && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glass-panel p-6 rounded-xl border-brand-border text-center hover:border-brand-primary/50 transition-colors">
              <p className="text-3xl font-bold text-white mb-1">{data.deployments.length}</p>
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
                Deployments
              </p>
            </div>
            <div className="glass-panel p-6 rounded-xl border-brand-success/30 text-center hover:border-brand-success/50 transition-colors">
              <p className="text-3xl font-bold text-brand-success mb-1">{healthyDeployments}</p>
              <p className="text-xs font-semibold text-brand-success uppercase tracking-wider">
                Healthy
              </p>
            </div>
            <div className="glass-panel p-6 rounded-xl border-brand-border text-center hover:border-brand-primary/50 transition-colors">
              <p className="text-3xl font-bold text-white mb-1">{data.pods.length}</p>
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
                Total Pods
              </p>
            </div>
            <div className="glass-panel p-6 rounded-xl border-brand-danger/30 text-center hover:border-brand-danger/50 transition-colors">
              <p className="text-3xl font-bold text-brand-danger mb-1">{unHealthyPods}</p>
              <p className="text-xs font-semibold text-brand-danger uppercase tracking-wider">
                Unhealthy Pods
              </p>
            </div>
            <div className="glass-panel p-6 rounded-xl border-yellow-500/30 text-center hover:border-yellow-500/50 transition-colors col-span-2 md:col-span-1">
              <p className="text-3xl font-bold text-yellow-500 mb-1">{totalRestarts}</p>
              <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wider">
                Total Restarts
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-xl border-brand-border overflow-hidden">
            <div className="p-5 border-b border-brand-border/50 bg-brand-dark/50">
              <h2 className="text-lg font-bold text-white">Deployments</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-surfaceHover/50 text-brand-muted text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Name</th>
                    <th className="p-4 font-semibold">Namespace</th>
                    <th className="p-4 font-semibold">Desired</th>
                    <th className="p-4 font-semibold">Available</th>
                    <th className="p-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/50 text-sm">
                  {data.deployments.map((dep) => (
                    <tr key={dep.name} className="hover:bg-brand-surfaceHover/30 transition-colors">
                      <td className="p-4 font-medium text-white">{dep.name}</td>
                      <td className="p-4 text-brand-muted">{dep.namespace}</td>
                      <td className="p-4 text-brand-text">{dep.desired}</td>
                      <td className="p-4 text-brand-text">{dep.available}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-md border ${
                            dep.status === 'healthy'
                              ? 'bg-brand-success/10 text-brand-success border-brand-success/30'
                              : 'bg-brand-danger/10 text-brand-danger border-brand-danger/30'
                          }`}
                        >
                          {dep.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel rounded-xl border-brand-border overflow-hidden">
            <div className="p-5 border-b border-brand-border/50 bg-brand-dark/50">
              <h2 className="text-lg font-bold text-white">Pods</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-surfaceHover/50 text-brand-muted text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Name</th>
                    <th className="p-4 font-semibold">Namespace</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Restarts</th>
                    <th className="p-4 font-semibold">CPU</th>
                    <th className="p-4 font-semibold">Memory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/50 text-sm">
                  {data.pods.map((pod) => (
                    <tr key={pod.name} className="hover:bg-brand-surfaceHover/30 transition-colors">
                      <td className="p-4 font-medium text-white font-mono text-xs">{pod.name}</td>
                      <td className="p-4 text-brand-muted">{pod.namespace}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-md border ${
                            pod.status.toLowerCase() === 'running'
                              ? 'bg-brand-success/10 text-brand-success border-brand-success/30'
                              : 'bg-brand-danger/10 text-brand-danger border-brand-danger/30'
                          }`}
                        >
                          {pod.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={
                            pod.restarts > 0 ? 'text-yellow-500 font-bold' : 'text-brand-muted'
                          }
                        >
                          {pod.restarts}
                        </span>
                      </td>
                      <td className="p-4 text-brand-primary">{pod.cpu}</td>
                      <td className="p-4 text-brand-primary">{pod.memory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
