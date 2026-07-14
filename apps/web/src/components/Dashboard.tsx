import { useEffect, useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface MetricData {
  timestamps?: string[];
  values?: number[];
}

interface PipelineRun {
  id?: string;
  name?: string;
  workflowName?: string;
  status?: string;
}

interface DashboardState {
  pipelines: {
    data: PipelineRun[];
  };
  infrastructure: {
    deployments: Record<string, unknown>[];
    pods: Record<string, unknown>[];
  };
  metrics: {
    cpu: MetricData | null;
    memory: MetricData | null;
  };
}

export default function Dashboard() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>(
    'connecting',
  );
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    // When deploying or running locally, Vite proxy might be used, but for direct WS:
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/api/ws/dashboard';

    const connectWs = () => {
      setWsStatus('connecting');
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'update') {
            setState(message.payload);
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        // Reconnect after 3 seconds
        setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    };

    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const getChartData = (
    metric: MetricData | null | undefined,
    label: string,
    color: string,
    bgColor: string,
  ) => {
    if (!metric || !metric.timestamps || !metric.values) {
      return {
        labels: [],
        datasets: [],
      };
    }
    return {
      labels: metric.timestamps.map((t: string) => new Date(t).toLocaleTimeString()),
      datasets: [
        {
          label,
          data: metric.values,
          borderColor: color,
          backgroundColor: bgColor,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#8b9bb4', // brand-muted
        },
      },
    },
    scales: {
      y: {
        grid: {
          color: 'rgba(139, 155, 180, 0.1)',
        },
        ticks: {
          color: '#8b9bb4',
        },
      },
      x: {
        grid: {
          color: 'rgba(139, 155, 180, 0.1)',
        },
        ticks: {
          color: '#8b9bb4',
        },
      },
    },
  };

  const cpuData = getChartData(
    state?.metrics?.cpu,
    'CPU Usage',
    '#00f0ff', // brand-primary
    'rgba(0, 240, 255, 0.1)',
  );

  const memoryData = getChartData(
    state?.metrics?.memory,
    'Memory Usage',
    '#ff00ff', // accent (magenta)
    'rgba(255, 0, 255, 0.1)',
  );

  const healthyDeployments =
    state?.infrastructure?.deployments?.filter(
      (d) => d.availableReplicas === d.replicas && d.replicas > 0,
    )?.length ?? 0;
  const totalDeployments = state?.infrastructure?.deployments?.length ?? 0;
  const runningPipelines =
    state?.pipelines?.data?.filter((p) => p.status === 'in_progress' || p.status === 'running')
      ?.length ?? 0;

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-8 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide mb-2">Dashboard</h1>
          <p className="text-brand-muted text-lg">Real-time system overview and live metrics.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-brand-surfaceHover border border-brand-border rounded-lg">
          <div
            className={`w-3 h-3 rounded-full ${
              wsStatus === 'connected'
                ? 'bg-brand-success animate-pulse'
                : wsStatus === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-brand-danger'
            }`}
          />
          <span className="text-sm font-medium text-brand-muted capitalize">
            {wsStatus === 'connected' ? 'Live' : wsStatus}
          </span>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl border-brand-primary/30 text-center hover:border-brand-primary transition-all duration-300">
          <h3 className="text-brand-muted text-sm font-semibold uppercase tracking-wider mb-3">
            Deployments Health
          </h3>
          <p className="text-4xl font-bold text-white flex items-center justify-center gap-2">
            <span
              className={
                healthyDeployments === totalDeployments && totalDeployments > 0
                  ? 'text-brand-success'
                  : 'text-yellow-500'
              }
            >
              {healthyDeployments}
            </span>
            <span className="text-2xl text-brand-muted">/ {totalDeployments}</span>
          </p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border-brand-primary/30 text-center hover:border-brand-primary transition-all duration-300">
          <h3 className="text-brand-muted text-sm font-semibold uppercase tracking-wider mb-3">
            Active Pipelines
          </h3>
          <p className="text-white text-4xl font-bold">{runningPipelines}</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border-brand-primary/30 text-center hover:border-brand-primary transition-all duration-300">
          <h3 className="text-brand-muted text-sm font-semibold uppercase tracking-wider mb-3">
            System Events
          </h3>
          <p className="text-brand-primary text-4xl font-bold">
            {state?.infrastructure?.pods?.length ?? 0}
            <span className="text-sm text-brand-muted ml-2 font-normal">Pods</span>
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border-brand-border h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4">CPU Usage (Live)</h3>
          <div className="flex-1 relative">
            {state?.metrics?.cpu ? (
              <Line data={cpuData} options={chartOptions} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-brand-muted">
                Not configured ( - )
              </div>
            )}
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl border-brand-border h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4">Memory Usage (Live)</h3>
          <div className="flex-1 relative">
            {state?.metrics?.memory ? (
              <Line data={memoryData} options={chartOptions} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-brand-muted">
                Not configured ( - )
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity / Pipelines */}
      <div className="glass-panel rounded-2xl border-brand-border overflow-hidden">
        <div className="p-6 border-b border-brand-border/50 bg-brand-dark/50">
          <h2 className="text-xl font-bold text-white">Recent Pipeline Runs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-surfaceHover/50 text-brand-muted text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Workflow</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Branch</th>
                <th className="p-4 font-semibold">Triggered At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50 text-sm">
              {(state?.pipelines?.data || []).slice(0, 5).map((run: PipelineRun) => (
                <tr
                  key={run.id || run.name}
                  className="hover:bg-brand-surfaceHover/30 transition-colors"
                >
                  <td className="p-4 font-medium text-white">{run.name || run.workflowName}</td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border ${
                        run.status === 'success' || run.status === 'completed'
                          ? 'text-brand-success bg-brand-success/10 border-brand-success/30'
                          : run.status === 'failed' || run.status === 'failure'
                            ? 'text-brand-danger bg-brand-danger/10 border-brand-danger/30'
                            : 'text-brand-primary bg-brand-primary/10 border-brand-primary/30 animate-pulse'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="p-4 text-brand-muted flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    {run.branch || 'main'}
                  </td>
                  <td className="p-4 text-brand-muted">
                    {run.createdAt ? new Date(run.createdAt).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
              {(!state?.pipelines?.data || state.pipelines.data.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-brand-muted">
                    No recent pipeline runs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
