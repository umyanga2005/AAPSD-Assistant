import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../api.js';

interface ActionPlan {
  id: string;
  projectId: string;
  environmentId: string;
  actionType: string;
  typedArgs: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
  actorId: string;
  approverId: string | null;
  policyResult: Record<string, unknown>;
  traceId: string;
  createdAt: string;
  updatedAt: string;
}

// removed unused AuditEvent

const DEFAULT_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_ENV_ID = '00000000-0000-0000-0000-000000000002'; // staging

function formatDate(iso: string): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    approved: 'text-brand-success bg-brand-success/10 border-brand-success/30',
    rejected: 'text-brand-danger bg-brand-danger/10 border-brand-danger/30',
    expired: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
    executed: 'text-brand-primary bg-brand-primary/10 border-brand-primary/30',
  };
  const color = colors[status] || colors.pending;
  return (
    <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-full border ${color}`}>
      {status === 'pending' ? 'Awaiting Approval' : status}
    </span>
  );
}

export default function ActionPlansPage() {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [actioning, setActioning] = useState(false);

  // Create form state
  const [newActionType, setNewActionType] = useState('kubernetes.deployment.restart');
  const [newArgs, setNewArgs] = useState(
    '{\n  "namespace": "staging",\n  "deploymentName": "api"\n}',
  );

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${apiUrl}/api/action-plans?projectId=${DEFAULT_PROJECT_ID}`);
      if (!res.ok) throw new Error('Failed to load plans');
      const data = await res.json();
      setPlans(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Error loading action plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [apiUrl]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      let parsedArgs;
      try {
        parsedArgs = JSON.parse(newArgs);
      } catch {
        throw new Error('Invalid JSON args');
      }

      const res = await fetchWithAuth(`${apiUrl}/api/action-plans`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: DEFAULT_PROJECT_ID,
          environmentId: DEFAULT_ENV_ID,
          actionType: newActionType,
          typedArgs: parsedArgs,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.reason || 'Failed to create plan');
      }

      await loadPlans();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (planId: string, action: 'approve' | 'reject') => {
    setActioning(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${apiUrl}/api/action-plans/${planId}/${action}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${action}`);
      }

      if (selectedPlan?.id === planId) {
        const updated = await res.json();
        setSelectedPlan(updated);
      }
      await loadPlans();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setActioning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-slide-in h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white tracking-wide">Governed Actions</h1>
            <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-brand-primary/10 text-brand-primary border border-brand-primary/30 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              Operations
            </span>
          </div>
          <p className="text-brand-muted text-lg">
            Safely request and approve operational action plans.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-brand-danger/10 border border-brand-danger/30 rounded-lg text-brand-danger">
          Error: {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Left Column: List and Create */}
        <div className="col-span-1 flex flex-col gap-6 overflow-y-auto pr-2">
          <div className="glass-panel p-6 rounded-xl border-brand-border">
            <h2 className="text-xl font-semibold text-white mb-4">Request Action</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-brand-muted mb-1">Action Type</label>
                <select
                  className="w-full bg-brand-dark/50 border border-brand-border rounded p-2 text-white"
                  value={newActionType}
                  onChange={(e) => setNewActionType(e.target.value)}
                >
                  <option value="kubernetes.deployment.restart">Restart Deployment</option>
                  <option value="kubernetes.deployment.scale">Scale Deployment</option>
                  <option value="github.workflow.dispatch">Trigger Workflow</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-brand-muted mb-1">Arguments (JSON)</label>
                <textarea
                  className="w-full h-32 bg-brand-dark/50 border border-brand-border rounded p-2 text-white font-mono text-sm"
                  value={newArgs}
                  onChange={(e) => setNewArgs(e.target.value)}
                />
              </div>
              <button
                className="w-full py-2 bg-brand-primary/20 text-brand-primary border border-brand-primary/50 hover:bg-brand-primary/30 rounded transition-colors disabled:opacity-50"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Action Plan'}
              </button>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-xl border-brand-border flex-1 flex flex-col min-h-0">
            <h2 className="text-xl font-semibold text-white mb-4">Recent Plans</h2>
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="w-8 h-8 border-2 border-brand-border border-t-brand-primary rounded-full animate-spin"></div>
              </div>
            ) : plans.length === 0 ? (
              <p className="text-brand-muted text-center p-8">No action plans found.</p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`p-4 rounded-lg cursor-pointer border transition-colors ${
                      selectedPlan?.id === plan.id
                        ? 'bg-brand-primary/10 border-brand-primary/50'
                        : 'bg-brand-surfaceHover/50 border-brand-border hover:border-brand-primary/30'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-sm text-white truncate">
                        {plan.actionType}
                      </span>
                      <StatusBadge status={plan.status} />
                    </div>
                    <div className="text-xs text-brand-muted">{formatDate(plan.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview & Timeline */}
        <div className="col-span-2 glass-panel rounded-xl border-brand-border p-6 overflow-y-auto">
          {selectedPlan ? (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-center border-b border-brand-border pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Plan Preview</h2>
                  <div className="text-sm font-mono text-brand-muted flex items-center gap-2">
                    ID: {selectedPlan.id}
                  </div>
                </div>
                <StatusBadge status={selectedPlan.status} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">
                    Plan Details
                  </h3>
                  <div className="space-y-3 bg-brand-surfaceHover/30 p-4 rounded-lg border border-brand-border">
                    <div>
                      <span className="text-brand-muted">Action:</span>{' '}
                      <span className="text-white font-mono ml-2">{selectedPlan.actionType}</span>
                    </div>
                    <div>
                      <span className="text-brand-muted">Target:</span>{' '}
                      <span className="text-white ml-2">
                        {JSON.stringify(selectedPlan.typedArgs)}
                      </span>
                    </div>
                    <div>
                      <span className="text-brand-muted">Environment:</span>{' '}
                      <span className="text-white ml-2 capitalize">
                        {(selectedPlan.policyResult?.environmentName as string) || 'staging'}
                      </span>
                    </div>
                    <div>
                      <span className="text-brand-muted">Risk Level:</span>
                      <span className="ml-2 text-amber-400 font-medium">Low - Staging Only</span>
                    </div>
                    <div>
                      <span className="text-brand-muted">Verification:</span>
                      <span className="text-white ml-2 text-sm">
                        System health checks and readiness probes must pass within 5m
                      </span>
                    </div>
                    <div>
                      <span className="text-brand-muted">Expiry:</span>
                      <span className="text-white ml-2">
                        {formatDate(
                          new Date(
                            new Date(selectedPlan.createdAt).getTime() + 1000 * 60 * 60,
                          ).toISOString(),
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-3">
                    Policy Result
                  </h3>
                  <div className="bg-brand-success/5 border border-brand-success/20 p-4 rounded-lg h-full">
                    <div className="flex items-center gap-2 text-brand-success mb-2">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        ></path>
                      </svg>
                      <span className="font-semibold">Policy Checks Passed</span>
                    </div>
                    <pre className="text-xs text-brand-success/70 font-mono mt-4 overflow-x-auto">
                      {JSON.stringify(selectedPlan.policyResult, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-brand-muted uppercase tracking-wider mb-4">
                  Approval Timeline
                </h3>
                <div className="relative border-l border-brand-border/50 ml-3 space-y-6">
                  <div className="relative pl-8">
                    <div className="absolute w-3 h-3 bg-brand-primary rounded-full -left-1.5 top-1.5 shadow-[0_0_8px_rgba(0,240,255,0.6)]"></div>
                    <p className="text-sm text-brand-muted mb-1">
                      {formatDate(selectedPlan.createdAt)}
                    </p>
                    <div className="bg-brand-surfaceHover/30 border border-brand-border p-3 rounded text-sm">
                      <span className="text-white font-semibold">Plan Created</span> by user{' '}
                      <span className="font-mono text-brand-primary">{selectedPlan.actorId}</span>
                    </div>
                  </div>

                  {selectedPlan.status === 'pending' && (
                    <div className="relative pl-8 animate-pulse">
                      <div className="absolute w-3 h-3 bg-amber-400 rounded-full -left-1.5 top-1.5 shadow-[0_0_8px_rgba(251,191,36,0.6)]"></div>
                      <p className="text-sm text-brand-muted mb-1">Now</p>
                      <div className="bg-amber-400/10 border border-amber-400/30 p-3 rounded text-sm">
                        <span className="text-amber-400 font-semibold">Awaiting Approval</span> from
                        DevOps Approver
                      </div>
                    </div>
                  )}

                  {selectedPlan.status === 'approved' && (
                    <div className="relative pl-8">
                      <div className="absolute w-3 h-3 bg-brand-success rounded-full -left-1.5 top-1.5 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                      <p className="text-sm text-brand-muted mb-1">
                        {formatDate(selectedPlan.updatedAt || new Date().toISOString())}
                      </p>
                      <div className="bg-brand-success/10 border border-brand-success/30 p-3 rounded text-sm">
                        <span className="text-brand-success font-semibold">Approved</span> by{' '}
                        <span className="font-mono">{selectedPlan.approverId}</span>
                      </div>
                    </div>
                  )}

                  {selectedPlan.status === 'rejected' && (
                    <div className="relative pl-8">
                      <div className="absolute w-3 h-3 bg-brand-danger rounded-full -left-1.5 top-1.5 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                      <p className="text-sm text-brand-muted mb-1">
                        {formatDate(selectedPlan.updatedAt || new Date().toISOString())}
                      </p>
                      <div className="bg-brand-danger/10 border border-brand-danger/30 p-3 rounded text-sm">
                        <span className="text-brand-danger font-semibold">Rejected</span> by{' '}
                        <span className="font-mono">{selectedPlan.approverId}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedPlan.status === 'pending' && (
                <div className="border-t border-brand-border pt-6 flex gap-4">
                  <button
                    className="flex-1 py-3 bg-brand-success/20 text-brand-success border border-brand-success/50 hover:bg-brand-success/30 rounded font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={() => handleAction(selectedPlan.id, 'approve')}
                    disabled={actioning}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                    {actioning ? 'Processing...' : 'Approve Plan'}
                  </button>
                  <button
                    className="flex-1 py-3 bg-brand-danger/20 text-brand-danger border border-brand-danger/50 hover:bg-brand-danger/30 rounded font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={() => handleAction(selectedPlan.id, 'reject')}
                    disabled={actioning}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                    {actioning ? 'Processing...' : 'Reject Plan'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-brand-muted opacity-50">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              <p>Select an action plan to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
