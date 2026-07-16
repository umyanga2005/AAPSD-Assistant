import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { actionRoutes } from '../src/routes/actions.js';
import { getGitHubAdapter, getK8sAdapter } from '@aapsd/diagnosis';
import { getConfigSafe } from '../src/config.js';
import { initQueue } from '../src/services/job-queue.js';
import { getDb } from '../src/db/index.js';

describe('Deployment Profiles & Local-Lite', () => {
  it('local-lite validates without redisUrl', () => {
    process.env.DEPLOYMENT_PROFILE = 'local-lite';
    process.env.DATABASE_URL = 'postgres://dummy';
    process.env.REDIS_URL = ''; // Missing

    const config = getConfigSafe();
    expect('_errors' in config).toBe(false);
    if (!('_errors' in config)) {
      expect(config.deploymentProfile).toBe('local-lite');
    }
  });

  it('staging-remote fails validation without redisUrl', () => {
    process.env.DEPLOYMENT_PROFILE = 'staging-remote';
    process.env.DATABASE_URL = 'postgres://dummy';
    process.env.REDIS_URL = ''; // Missing

    const config = getConfigSafe();
    expect('_errors' in config).toBe(true);
    if ('_errors' in config) {
      expect(config._errors.some((e) => e.includes('REDIS_URL is required'))).toBe(true);
    }
  });
});
