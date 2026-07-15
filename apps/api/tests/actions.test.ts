import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { actionRoutes } from '../src/routes/actions.js';

// Define mocks first
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
};

vi.mock('../src/db/index.js', () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock('../src/config.js', () => ({
  getConfig: vi.fn(() => ({
    gitHubAllowedRepos: ['owner/repo'],
    k8sAllowedNamespaces: ['staging'],
    actionAllowedDeployments: ['api'],
    actionMinScale: 1,
    actionMaxScale: 5,
  })),
  getConfigSafe: vi.fn(() => ({
    gitHubAllowedRepos: ['owner/repo'],
    k8sAllowedNamespaces: ['staging'],
    actionAllowedDeployments: ['api'],
    actionMinScale: 1,
    actionMaxScale: 5,
  })),
}));

vi.mock('../src/services/audit.js', () => ({
  AUDIT_ACTION_PLAN_CREATED: 'action.plan.created',
  AUDIT_ACTION_PLAN_DENIED: 'action.plan.denied',
  AUDIT_ACTION_PLAN_APPROVED: 'action.plan.approved',
  AUDIT_ACTION_PLAN_REJECTED: 'action.plan.rejected',
  AUDIT_ACTION_PLAN_EXPIRED: 'action.plan.expired',
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Provide a mock user middleware
const mockAuth = async (request: FastifyRequest) => {
  const req = request as unknown as Record<string, unknown>;
  if (request.headers['x-test-user-id']) {
    req.user = {
      id: request.headers['x-test-user-id'],
      role: request.headers['x-test-user-role'] || 'viewer',
    };
  }
};

describe('Governed Staging Actions', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();

    app.addHook('preHandler', mockAuth);
    await app.register(actionRoutes);

    // Default mocks
    mockDb.limit.mockResolvedValue([]);
    mockDb.returning.mockResolvedValue([{ id: 'mock-plan-id', status: 'pending' }]);
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects action if environment is production', async () => {
    mockDb.limit.mockResolvedValueOnce([{ role: 'developer' }]); // project member
    mockDb.limit.mockResolvedValueOnce([{ name: 'production' }]); // environment

    const response = await app.inject({
      method: 'POST',
      url: '/action-plans',
      headers: {
        'x-test-user-id': 'dev-user-id',
      },
      payload: {
        projectId: '00000000-0000-0000-0000-000000000001',
        environmentId: '00000000-0000-0000-0000-000000000002',
        actionType: 'kubernetes.deployment.restart',
        typedArgs: { namespace: 'staging', deploymentName: 'api' },
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Policy Denied');
    expect(body.reason).toContain('not allowed in production');
  });

  it('rejects action if user does not have sufficient role', async () => {
    mockDb.limit.mockResolvedValueOnce([{ role: 'viewer' }]); // project member
    mockDb.limit.mockResolvedValueOnce([{ name: 'staging' }]); // environment

    const response = await app.inject({
      method: 'POST',
      url: '/action-plans',
      headers: {
        'x-test-user-id': 'dev-user-id',
      },
      payload: {
        projectId: '00000000-0000-0000-0000-000000000001',
        environmentId: '00000000-0000-0000-0000-000000000002',
        actionType: 'kubernetes.deployment.restart',
        typedArgs: { namespace: 'staging', deploymentName: 'api' },
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.reason).toContain('Insufficient role');
  });

  it('rejects scaling outside min/max limits', async () => {
    mockDb.limit.mockResolvedValueOnce([{ role: 'developer' }]); // project member
    mockDb.limit.mockResolvedValueOnce([{ name: 'staging' }]); // environment

    const response = await app.inject({
      method: 'POST',
      url: '/action-plans',
      headers: {
        'x-test-user-id': 'dev-user-id',
      },
      payload: {
        projectId: '00000000-0000-0000-0000-000000000001',
        environmentId: '00000000-0000-0000-0000-000000000002',
        actionType: 'kubernetes.deployment.scale',
        typedArgs: { namespace: 'staging', deploymentName: 'api', replicas: 10 }, // max is 5
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.reason).toContain('exceeds maximum');
  });

  it('creates an action plan when policy passes', async () => {
    mockDb.limit.mockResolvedValueOnce([{ role: 'developer' }]); // project member
    mockDb.limit.mockResolvedValueOnce([{ name: 'staging' }]); // environment

    const response = await app.inject({
      method: 'POST',
      url: '/action-plans',
      headers: {
        'x-test-user-id': 'dev-user-id',
      },
      payload: {
        projectId: '00000000-0000-0000-0000-000000000001',
        environmentId: '00000000-0000-0000-0000-000000000002',
        actionType: 'kubernetes.deployment.restart',
        typedArgs: { namespace: 'staging', deploymentName: 'api' },
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it('rejects approval from user without approver role', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: '00000000-0000-0000-0000-000000000003', projectId: 'proj-id', status: 'pending' },
    ]); // plan
    mockDb.limit.mockResolvedValueOnce([{ role: 'developer' }]); // project member

    const response = await app.inject({
      method: 'POST',
      url: '/action-plans/00000000-0000-0000-0000-000000000003/approve',
      headers: {
        'x-test-user-id': 'dev-user-id',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Insufficient role');
  });

  it('allows approval from user with approver role', async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: '00000000-0000-0000-0000-000000000003', projectId: 'proj-id', status: 'pending' },
    ]); // plan
    mockDb.limit.mockResolvedValueOnce([{ role: 'approver' }]); // project member

    const response = await app.inject({
      method: 'POST',
      url: '/action-plans/00000000-0000-0000-0000-000000000003/approve',
      headers: {
        'x-test-user-id': 'approver-user-id',
      },
    });

    expect(response.statusCode).toBe(200);
  });
});
