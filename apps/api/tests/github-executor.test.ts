import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PolicyEvaluator } from '@aapsd/policy';
import {
  executeGitHubWorkflow,
  MockGitHubExecutorAdapter,
} from '../src/services/github-executor.js';
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
    gitHubAllowedRepos: ['owner/allowed-repo'],
    gitHubAllowedWorkflows: ['deploy.yml'],
    k8sAllowedNamespaces: [],
    actionAllowedDeployments: [],
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

describe('Policy Test: GitHub Workflow Dispatch', () => {
  it('allows workflow dispatch for allowed repo and workflow', () => {
    const evaluator = new PolicyEvaluator({
      allowedRepos: ['owner/allowed-repo'],
      allowedWorkflows: ['deploy.yml'],
      allowedNamespaces: [],
      allowedDeployments: [],
      minScale: 1,
      maxScale: 5,
    });

    const result = evaluator.evaluate({
      environmentName: 'staging',
      userRole: 'developer',
      actionType: 'github.workflow.dispatch',
      args: { repo: 'owner/allowed-repo', workflowId: 'deploy.yml', ref: 'main' },
    });
    expect(result.allowed).toBe(true);
  });

  it('rejects workflow dispatch for unlisted repo', () => {
    const evaluator = new PolicyEvaluator({
      allowedRepos: ['owner/allowed-repo'],
      allowedWorkflows: ['deploy.yml'],
      allowedNamespaces: [],
      allowedDeployments: [],
      minScale: 1,
      maxScale: 5,
    });

    const result = evaluator.evaluate({
      environmentName: 'staging',
      userRole: 'developer',
      actionType: 'github.workflow.dispatch',
      args: { repo: 'owner/hacked-repo', workflowId: 'deploy.yml', ref: 'main' },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Repository not in allowlist');
  });
});

describe('Executor Test: executeGitHubWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.limit.mockReset();
    mockDb.limit.mockReturnThis();
  });

  it('successfully executes an approved staging plan', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'plan-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        actionType: 'github.workflow.dispatch',
        status: 'approved',
        typedArgs: { repo: 'owner/allowed-repo', workflowId: 'deploy.yml', ref: 'main' },
      },
    ]);
    mockDb.limit.mockResolvedValueOnce([{ name: 'staging' }]); // environment
    mockDb.limit.mockResolvedValueOnce([{ role: 'devops_engineer' }]); // user role

    const result = await executeGitHubWorkflow('plan-1', 'user-1', new MockGitHubExecutorAdapter());

    expect(result.status).toBe('succeeded');
    // Expect audit events queued, running, succeeded
    expect(audit.recordAuditEvent).toHaveBeenCalledTimes(3);
    // Expect db.update to be called to set queued, running, succeeded
    expect(mockDb.update).toHaveBeenCalledTimes(3);
  });

  it('rejects execution if plan is not approved', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'plan-1',
        status: 'pending',
      },
    ]);

    await expect(executeGitHubWorkflow('plan-1', 'user-1')).rejects.toThrow(
      'Plan is not approved (current status: pending)',
    );
  });

  it('rejects execution for production environment', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'plan-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        actionType: 'github.workflow.dispatch',
        status: 'approved',
        typedArgs: { repo: 'owner/allowed-repo', workflowId: 'deploy.yml', ref: 'main' },
      },
    ]);
    mockDb.limit.mockResolvedValueOnce([{ name: 'production' }]); // environment

    await expect(executeGitHubWorkflow('plan-1', 'user-1')).rejects.toThrow(
      'Execution is only permitted in the staging environment',
    );
  });
});

describe('Integration Test: POST /action-plans/:id/execute', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb.limit.mockReset();
    mockDb.limit.mockReturnThis();
    app = Fastify();

    app.addHook('preHandler', async (request: unknown) => {
      (request as Record<string, unknown>).user = { id: 'user-1', role: 'devops_engineer' };
    });

    await app.register(actionRoutes);
  });

  it('returns 200 and executes plan', async () => {
    // Mock for actions.ts fetch
    mockDb.limit.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000001',
        projectId: 'proj-1',
        environmentId: 'env-1',
        actionType: 'github.workflow.dispatch',
        status: 'approved',
        typedArgs: { repo: 'owner/allowed-repo', workflowId: 'deploy.yml', ref: 'main' },
      },
    ]);
    // Mock for executeGitHubWorkflow plan fetch
    mockDb.limit.mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-000000000001',
        projectId: 'proj-1',
        environmentId: 'env-1',
        actionType: 'github.workflow.dispatch',
        status: 'approved',
        typedArgs: { repo: 'owner/allowed-repo', workflowId: 'deploy.yml', ref: 'main' },
      },
    ]);
    mockDb.limit.mockResolvedValueOnce([{ name: 'staging' }]); // environment
    mockDb.limit.mockResolvedValueOnce([{ role: 'devops_engineer' }]); // user role

    const response = await app.inject({
      method: 'POST',
      url: '/action-plans/00000000-0000-0000-0000-000000000001/execute',
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(202);
    expect(body.message).toBe('Execution queued');
    expect(body.jobId).toBeDefined();
  });
});
