import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, ConfigError } from '../src/config.js';

const OLD_ENV = process.env;

describe('getConfig', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.PORT;
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.CORS_ORIGIN;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe('valid configuration', () => {
    it('returns config with all required values', () => {
      process.env.PORT = '4000';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://:pass@localhost:6379/0';
      process.env.CORS_ORIGIN = 'http://example.com';
      process.env.NODE_ENV = 'production';

      const config = getConfig();
      expect(config.port).toBe(4000);
      expect(config.databaseUrl).toBe('postgresql://user:pass@localhost:5432/db');
      expect(config.redisUrl).toBe('redis://:pass@localhost:6379/0');
      expect(config.corsOrigin).toBe('http://example.com');
      expect(config.nodeEnv).toBe('production');
    });

    it('applies defaults when optional values are omitted', () => {
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      process.env.REDIS_URL = 'redis://:p@localhost:6379/0';

      const config = getConfig();
      expect(config.port).toBe(3000);
      expect(config.corsOrigin).toBe('http://localhost:5173');
      expect(config.nodeEnv).toBe('development');
    });

    it('accepts test NODE_ENV', () => {
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      process.env.REDIS_URL = 'redis://:p@localhost:6379/0';
      process.env.NODE_ENV = 'test';

      const config = getConfig();
      expect(config.nodeEnv).toBe('test');
    });
  });

  describe('missing required values', () => {
    it('throws ConfigError when DATABASE_URL is missing', () => {
      process.env.REDIS_URL = 'redis://:p@localhost:6379/0';
      expect(() => getConfig()).toThrow(ConfigError);
    });

    it('throws ConfigError when REDIS_URL is missing', () => {
      process.env.DEPLOYMENT_PROFILE = 'staging-remote';
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      expect(() => getConfig()).toThrow(ConfigError);
    });

    it('lists all missing errors in a single message', () => {
      process.env.DEPLOYMENT_PROFILE = 'staging-remote';
      try {
        getConfig();
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        const msg = (err as ConfigError).message;
        expect(msg).toContain('DATABASE_URL is required');
        expect(msg).toContain('REDIS_URL is required');
      }
    });
  });

  describe('invalid values', () => {
    it('rejects non-numeric PORT', () => {
      process.env.PORT = 'abc';
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      process.env.REDIS_URL = 'redis://:p@localhost:6379/0';

      expect(() => getConfig()).toThrow('PORT must be a positive integer');
    });

    it('rejects zero PORT', () => {
      process.env.PORT = '0';
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      process.env.REDIS_URL = 'redis://:p@localhost:6379/0';

      expect(() => getConfig()).toThrow('PORT must be a positive integer');
    });

    it('rejects negative PORT', () => {
      process.env.PORT = '-1';
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      process.env.REDIS_URL = 'redis://:p@localhost:6379/0';

      expect(() => getConfig()).toThrow('PORT must be a positive integer');
    });

    it('rejects invalid NODE_ENV', () => {
      process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
      process.env.REDIS_URL = 'redis://:p@localhost:6379/0';
      process.env.NODE_ENV = 'staging';

      expect(() => getConfig()).toThrow('NODE_ENV must be one of: development, production, test');
    });
  });
});
