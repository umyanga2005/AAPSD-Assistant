import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PolicyEvaluator } from '@aapsd/policy';
import {
  executeKubernetesRestart,
  MockKubernetesExecutorAdapter,
} from '../src/services/kubernetes-executor.js';
import Fastify from 'fastify';
import { actionRoutes } from '../src/routes/actions.js';
import * as audit from '../src/services/audit.js';

// Mock DB
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
};

vi.mock('../src/db/index.js', () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock('../src/config.js', () => ({
  getConfigSafe: vi.fn(() => ({
    gitHubAllowedRepos: [],
    gitHubAllowedWorkflows: [],
    k8sAllowedNamespaces: ['staging-ns'],
    actionAllowedDeployments: ['api-service'],
    actionMinScale: 1,
    actionMaxScale: 5,
    nodeEnv: 'test',
  })),
}));

vi.mock('../src/services/audit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/audit.js')>();
  return {
    ...actual,
    recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Policy Test: Kubernetes Deployment Restart', () => {
  it('allows restart for allowed namespace and deployment', () => {
    const evaluator = new PolicyEvaluator({
      allowedRepos: [],
      allowedWorkflows: [],
      allowedNamespaces: ['staging-ns'],
      allowedDeployments: ['api-service'],
      minScale: 1,
      maxScale: 5,
    });

    const result = evaluator.evaluate({
      environmentName: 'staging',
      userRole: 'developer',
      actionType: 'kubernetes.deployment.restart',
      args: { namespace: 'staging-ns', deploymentName: 'api-service' },
    });
    expect(result.allowed).toBe(true);
  });

  it('rejects restart for invalid namespace', () => {
    const evaluator = new PolicyEvaluator({
      allowedRepos: [],
      allowedWorkflows: [],
      allowedNamespaces: ['staging-ns'],
      allowedDeployments: ['api-service'],
      minScale: 1,
      maxScale: 5,
    });

    const result = evaluator.evaluate({
      environmentName: 'staging',
      userRole: 'developer',
      actionType: 'kubernetes.deployment.restart',
      args: { namespace: 'kube-system', deploymentName: 'api-service' },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Namespace not in allowlist');
  });

  it('rejects restart for invalid deployment', () => {
    const evaluator = new PolicyEvaluator({
      allowedRepos: [],
      allowedWorkflows: [],
      allowedNamespaces: ['staging-ns'],
      allowedDeployments: ['api-service'],
      minScale: 1,
      maxScale: 5,
    });

    const result = evaluator.evaluate({
      environmentName: 'staging',
      userRole: 'developer',
      actionType: 'kubernetes.deployment.restart',
      args: { namespace: 'staging-ns', deploymentName: 'vault' },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Deployment not in allowlist');
  });
});

describe('Executor Test: executeKubernetesRestart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully executes an approved staging plan', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'plan-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        actionType: 'kubernetes.deployment.restart',
        status: 'approved',
        typedArgs: { namespace: 'staging-ns', deploymentName: 'api-service' },
      },
    ]);
    mockDb.limit.mockResolvedValueOnce([{ name: 'staging' }]); // environment
    mockDb.limit.mockResolvedValueOnce([{ role: 'devops_engineer' }]); // user role

    const result = await executeKubernetesRestart(
      'plan-1',
      'user-1',
      new MockKubernetesExecutorAdapter(),
    );

    expect(result.status).toBe('succeeded');
    expect(audit.recordAuditEvent).toHaveBeenCalledTimes(3);
    expect(mockDb.update).toHaveBeenCalledTimes(3);
  });

  it('rejects execution if plan is not approved', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'plan-1',
        status: 'pending',
      },
    ]);

    await expect(executeKubernetesRestart('plan-1', 'user-1')).rejects.toThrow(
      'Plan is not approved',
    );
  });

  it('rejects execution for expired plan', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'plan-1',
        status: 'approved',
        expiresAt: new Date(Date.now() - 10000).toISOString(),
      },
    ]);

    await expect(executeKubernetesRestart('plan-1', 'user-1')).rejects.toThrow('Plan has expired');
  });

  it('rejects execution for production environment', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'plan-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        actionType: 'kubernetes.deployment.restart',
        status: 'approved',
        typedArgs: { namespace: 'staging-ns', deploymentName: 'api-service' },
      },
    ]);
    mockDb.limit.mockResolvedValueOnce([{ name: 'production' }]); // environment

    await expect(executeKubernetesRestart('plan-1', 'user-1')).rejects.toThrow(
      'Execution is only permitted in the staging environment',
    );
  });
});

describe('Integration Test: POST /action-plans/:id/execute (Kubernetes Restart)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();

    app.addHook('preHandler', async (request: unknown) => {
      (request as Record<string, unknown>).user = { id: 'user-1', role: 'devops_engineer' };
    });

    await app.register(actionRoutes);
  });

  it('returns 200 and executes kubernetes restart plan', async () => {
    // For execute action plan endpoint
    mockDb.limit.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000002',
        projectId: 'proj-1',
        environmentId: 'env-1',
        actionType: 'kubernetes.deployment.restart',
        status: 'approved',
        typedArgs: { namespace: 'staging-ns', deploymentName: 'api-service' },
      },
    ]);

    // For executeKubernetesRestart internals
    mockDb.limit.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000002',
        projectId: 'proj-1',
        environmentId: 'env-1',
        actionType: 'kubernetes.deployment.restart',
        status: 'approved',
        typedArgs: { namespace: 'staging-ns', deploymentName: 'api-service' },
      },
    ]);
    mockDb.limit.mockResolvedValueOnce([{ name: 'staging' }]); // environment
    mockDb.limit.mockResolvedValueOnce([{ role: 'devops_engineer' }]); // user role

    const response = await app.inject({
      method: 'POST',
      url: '/action-plans/00000000-0000-0000-0000-000000000002/execute',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('succeeded');
  });
});
