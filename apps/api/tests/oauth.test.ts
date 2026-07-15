import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import authRoutes from '../src/routes/auth.js';
import * as dbModule from '../src/db/index.js';
import { oauthStates, userIntegrations } from '../src/db/schema.js';

const mockOauthStatesSelect = vi.fn();
const mockUserIntegrationsSelect = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));
const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockFrom = vi.fn((table: unknown) => {
  if (table === oauthStates) {
    return {
      where: vi.fn(() => ({
        limit: mockOauthStatesSelect,
      })),
    };
  }
  if (table === userIntegrations) {
    return {
      where: vi.fn(() => ({
        limit: mockUserIntegrationsSelect,
      })),
    };
  }
  return { where: vi.fn() };
});

const mockDb = {
  select: vi.fn(() => ({ from: mockFrom })),
  insert: mockInsert,
  delete: mockDelete,
  update: mockUpdate,
};

vi.mock('../src/db/index.js', () => ({
  getDb: vi.fn(),
}));

describe('OAuth Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbModule.getDb).mockReturnValue(mockDb as any);
    mockInsertValues.mockResolvedValue(undefined);
    mockDeleteWhere.mockResolvedValue(undefined);

    const Fastify = (await import('fastify')).default;
    app = Fastify();

    app.register(authRoutes, {
      devAuthPreHandler: async (req, _res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = { id: 'test-user-id' };
      },
    });
  });

  it('generates secure OAuth URL and saves state', async () => {
    process.env.GITHUB_CLIENT_ID = 'test-client';

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/github/url',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.url).toContain('https://github.com/login/oauth/authorize');
    expect(body.url).toContain('client_id=test-client');
    expect(body.url).toContain('state=');
    expect(mockInsert).toHaveBeenCalledWith(oauthStates);
  });

  it('rejects missing state in callback', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/github/callback?code=abc', // missing state
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('GITHUB_OAUTH_ERROR');
    expect(response.body).toContain('Missing code or state');
  });

  it('rejects invalid or replayed state in callback', async () => {
    mockOauthStatesSelect.mockResolvedValue([]); // State not found

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/github/callback?code=abc&state=invalid-state',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('GITHUB_OAUTH_ERROR');
    expect(response.body).toContain('Invalid or expired state');
  });
});
