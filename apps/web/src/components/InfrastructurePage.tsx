import { useEffect, useState } from 'react';

interface Deployment {
  name: string;
  namespace: string;
  replicas: number;
  availableReplicas: number;
  readyReplicas?: number;
  updatedReplicas?: number;
  strategy?: string;
  conditions?: string[];
  createdAt?: string;
}

interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state: string;
  started?: boolean;
}

interface PodInfo {
  name: string;
  namespace: string;
  phase: string;
  status: string;
  containers: ContainerStatus[];
  nodeName?: string;
  podIP?: string;
  createdAt?: string;
}

interface InfrastructureData {
  deployments: Deployment[];
  pods: PodInfo[];
}

type ViewState = 'loading' | 'success' | 'error';

export default function InfrastructurePage() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [data, setData] = useState<InfrastructureData | null>(null);

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
        setViewState('error');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const totalRestarts =
    data?.pods.reduce(
      (sum, p) => sum + (p.containers?.reduce((cSum, c) => cSum + (c.restartCount || 0), 0) || 0),
      0,
    ) ?? 0;
  const healthyDeployments =
    data?.deployments.filter((d) => d.availableReplicas >= d.replicas && d.replicas > 0).length ??
    0;
  const unHealthyPods =
    data?.pods.filter((p) => p.phase !== 'Running' && p.phase !== 'Succeeded').length ?? 0;

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
                  {data.deployments.map((dep) => {
                    const isHealthy = dep.availableReplicas >= dep.replicas && dep.replicas > 0;
                    return (
                      <tr
                        key={dep.name}
                        className="hover:bg-brand-surfaceHover/30 transition-colors"
                      >
                        <td className="p-4 font-medium text-white">{dep.name}</td>
                        <td className="p-4 text-brand-muted">{dep.namespace}</td>
                        <td className="p-4 text-brand-text">{dep.replicas}</td>
                        <td className="p-4 text-brand-text">{dep.availableReplicas}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-md border ${
                              isHealthy
                                ? 'bg-brand-success/10 text-brand-success border-brand-success/30'
                                : 'bg-brand-danger/10 text-brand-danger border-brand-danger/30'
                            }`}
                          >
                            {isHealthy ? 'healthy' : 'degraded'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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
                  {data.pods.map((pod) => {
                    const restarts =
                      pod.containers?.reduce((cSum, c) => cSum + (c.restartCount || 0), 0) || 0;
                    return (
                      <tr
                        key={pod.name}
                        className="hover:bg-brand-surfaceHover/30 transition-colors"
                      >
                        <td className="p-4 font-medium text-white font-mono text-xs">{pod.name}</td>
                        <td className="p-4 text-brand-muted">{pod.namespace}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-md border ${
                              pod.phase === 'Running' || pod.phase === 'Succeeded'
                                ? 'bg-brand-success/10 text-brand-success border-brand-success/30'
                                : 'bg-brand-danger/10 text-brand-danger border-brand-danger/30'
                            }`}
                          >
                            {pod.phase || 'Unknown'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={
                              restarts > 0 ? 'text-yellow-500 font-bold' : 'text-brand-muted'
                            }
                          >
                            {restarts}
                          </span>
                        </td>
                        <td className="p-4 text-brand-primary/50 text-xs italic">N/A</td>
                        <td className="p-4 text-brand-primary/50 text-xs italic">N/A</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
