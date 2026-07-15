import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';
import * as authService from '../src/services/auth.js';

vi.mock('../src/services/auth.js', async () => {
  const actual = await vi.importActual('../src/services/auth.js');
  return {
    ...actual,
    getProjectRole: vi.fn(),
    resolveDevUser: vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'test@local',
      name: 'Test',
      role: 'viewer'
    }),
  };
});

vi.mock('../src/db/index.js', () => ({
  getDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      { accessToken: 'test-token' }
    ])
  })
}));

vi.mock('../src/services/encryption.js', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-token'),
  encrypt: vi.fn().mockReturnValue('encrypted-token'),
}));

describe('Read-Only Intelligence Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.GITHUB_CLIENT_ID = 'test';
    process.env.GITHUB_CLIENT_SECRET = 'test';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scope denial', () => {
    it('returns 403 when trying to access pipelines without viewer role', async () => {
      vi.mocked(authService.getProjectRole).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipelines?project_id=test-project',
        headers: {
          'x-dev-user-id': 'user-1',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns 403 when trying to access infrastructure without viewer role', async () => {
      vi.mocked(authService.getProjectRole).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/infrastructure?project_id=test-project',
        headers: {
          'x-dev-user-id': 'user-1',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Integration failure', () => {
    it('handles pipeline requests without crashing', async () => {
      vi.mocked(authService.getProjectRole).mockResolvedValueOnce('viewer');
      const response = await app.inject({
        method: 'GET',
        url: '/api/pipelines?project_id=test-project',
        headers: {
          'x-dev-user-id': 'user-1',
        },
      });
      expect([200, 502]).toContain(response.statusCode);
    });
  });
});
