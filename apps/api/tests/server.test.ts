import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';
import * as authService from '../src/services/auth.js';

vi.mock('../src/services/auth.js', async () => {
  const actual = await vi.importActual('../src/services/auth.js');
  return {
    ...actual,
    resolveDevUser: vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'test@local',
      name: 'Test',
      role: 'admin'
    }),
  };
});

describe('API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns 200 with status, service, and timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('service', '@aapsd/api');
      expect(body).toHaveProperty('timestamp');
      expect(typeof body.timestamp).toBe('string');
    });
  });

  describe('GET /api/ws/dashboard', () => {
    it('accepts a WebSocket upgrade', async () => {
      const socket = await app.injectWS('/api/ws/dashboard', {
        headers: {
          'x-dev-user-id': 'user-1',
          'x-dev-role': 'admin', // Need a role to bypass the _requireProjectRole middleware for now if we test it without project
        },
      });

      expect(socket.readyState).toBe(1);
      socket.close();
    });
  });

  describe('GET /ready', () => {
    it('returns 200 with database status and uptime', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('database');
      expect(body).toHaveProperty('uptime');
      expect(typeof body.uptime).toBe('number');
    });
  });

  describe('error handling', () => {
    it('returns 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/unknown',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });
  });
});
