import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/index.js';
import type { FastifyInstance } from 'fastify';
import * as dbModule from '../src/db/index.js';

vi.mock('../src/db/index.js', () => ({
  getDb: vi.fn(),
  testConnection: vi.fn(),
}));

describe('Observability & Health Checks', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('adds x-trace-id header to responses', async () => {
    vi.mocked(dbModule.testConnection).mockResolvedValue(true);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.headers['x-trace-id']).toBeDefined();
    expect(typeof response.headers['x-trace-id']).toBe('string');
  });

  it('returns 200 OK when health checks pass', async () => {
    vi.mocked(dbModule.testConnection).mockResolvedValue(true);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', db: 'connected' });
  });

  it('returns 503 Service Unavailable when DB is down', async () => {
    vi.mocked(dbModule.testConnection).mockResolvedValue(false);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'error', db: 'disconnected' });
  });

  it('exposes prometheus metrics endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.payload).toContain('api_http_request_duration_seconds');
  });
});
