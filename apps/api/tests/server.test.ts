import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/index.js';

describe('API', () => {
  const app = buildApp();

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

  describe('GET /ready', () => {
    it('returns 200 with status and uptime', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
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
