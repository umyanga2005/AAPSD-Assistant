import { describe, it, expect } from 'vitest';
import { redactSecrets, redactEvidence } from '../src/redactor.js';

describe('redactSecrets', () => {
  describe('multi-line patterns', () => {
    it('redacts RSA private keys', () => {
      const input = `-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----`;
      const result = redactSecrets(input);
      expect(result).not.toContain('MIIEpAIBAAKCAQEA');
      expect(result).toContain('[REDACTED]');
    });

    it('redacts EC private keys', () => {
      const input = `-----BEGIN EC PRIVATE KEY-----\nMHQCAQEEIIm3V2o=\n-----END EC PRIVATE KEY-----`;
      const result = redactSecrets(input);
      expect(result).not.toContain('MHQCAQEEIIm3V2o=');
      expect(result).toContain('[REDACTED]');
    });

    it('redacts DSA private keys', () => {
      const input = `-----BEGIN DSA PRIVATE KEY-----\nMIIBugIBAAKBgQCG\n-----END DSA PRIVATE KEY-----`;
      const result = redactSecrets(input);
      expect(result).not.toContain('MIIBugIBAAKBgQCG');
      expect(result).toContain('[REDACTED]');
    });

    it('redacts OPENSSH private keys', () => {
      const input = `-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----`;
      const result = redactSecrets(input);
      expect(result).not.toContain('b3BlbnNzaC1rZXktdjEAAAAA');
      expect(result).toContain('[REDACTED]');
    });

    it('redacts encrypted private keys', () => {
      const input = `-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFHDBOBgkqhkiG\n-----END ENCRYPTED PRIVATE KEY-----`;
      const result = redactSecrets(input);
      expect(result).not.toContain('MIIFHDBOBgkqhkiG');
      expect(result).toContain('[REDACTED]');
    });

    it('redacts PEM certificates', () => {
      const input = `-----BEGIN CERTIFICATE-----\nMIIDIjCCAougAwIBAgIJ\n-----END CERTIFICATE-----`;
      const result = redactSecrets(input);
      expect(result).not.toContain('MIIDIjCCAougAwIBAgIJ');
      expect(result).toContain('[REDACTED]');
    });

    it('redacts private keys without algorithm prefix', () => {
      const input = `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQY\n-----END PRIVATE KEY-----`;
      const result = redactSecrets(input);
      expect(result).not.toContain('MC4CAQAwBQY');
      expect(result).toContain('[REDACTED]');
    });
  });

  describe('line-level tokens', () => {
    it('redacts GitHub classic PATs', () => {
      const raw = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd';
      expect(redactSecrets(raw)).toContain('[REDACTED]');
    });

    it('redacts GitHub OAuth tokens', () => {
      const raw = 'gho_abcdefghijklmnopqrstuvwxyz0123456789abcd';
      expect(redactSecrets(raw)).toContain('[REDACTED]');
    });

    it('redacts GitHub fine-grained PATs', () => {
      const raw = 'github_pat_11ABCabcdeFghijkLmnoPQRST';
      expect(redactSecrets(raw)).toContain('[REDACTED]');
    });

    it('redacts AWS access keys', () => {
      const raw = 'AKIAIOSFODNN7EXAMPLE';
      expect(redactSecrets(raw)).toContain('[REDACTED]');
    });

    it('redacts AWS session keys', () => {
      const raw = 'ASIAIOSFODNN7EXAMPLE';
      expect(redactSecrets(raw)).toContain('[REDACTED]');
    });

    it('redacts OpenAI-style API keys', () => {
      const raw = 'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnop';
      expect(redactSecrets(raw)).toContain('[REDACTED]');
    });

    it('redacts OpenRouter-specific keys', () => {
      const raw = 'sk-or-v1-abcdefghijklmnopqrstuvwxyz0123456789abcdefghij';
      expect(redactSecrets(raw)).toContain('[REDACTED]');
    });

    it('redacts Slack tokens', () => {
      expect(redactSecrets('xoxb-1234567890-abcdefghijklmnopqrstuvwxyz')).toContain('[REDACTED]');
      expect(redactSecrets('xoxp-1234567890-abcdefghijklmnopqrstuvwxyz')).toContain('[REDACTED]');
    });

    it('redacts JWT tokens', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIn0.abcdefghijklmnopqrstuvwxyz0123456789-ABC_DEF';
      const result = redactSecrets(jwt);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('eyJhbGci');
    });

    it('redacts database URLs with embedded credentials', () => {
      const inputs = [
        'postgresql://admin:supersecret@db.internal:5432/production',
        'mysql://deploy:pass123@mysql.internal:3306/app',
        'mongodb://root:toor@mongo-0.cluster:27017/admin',
        'redis://:authpass@redis.internal:6379/0',
      ];
      for (const input of inputs) {
        const result = redactSecrets(input);
        expect(result, `Failed for: ${input}`).toContain('[REDACTED]');
      }
    });

    it('redacts database URLs and preserves protocol prefix', () => {
      const input = 'postgresql://readonly:secret123@db.internal/production';
      const result = redactSecrets(input);
      expect(result).not.toContain('readonly:secret123');
      expect(result).not.toContain('readonly');
    });

    it('redacts SSH public keys', () => {
      const inputs = [
        'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC3... user@host',
        'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIVyZQ== user@host',
        'ssh-dss AAAAB3NzaC1kc3MAAACBAI8Vg... user@host',
      ];
      for (const input of inputs) {
        const result = redactSecrets(input);
        expect(result, `Failed for: ${input}`).toContain('[REDACTED]');
      }
    });

    it('redacts Azure storage account keys', () => {
      const raw =
        'DefaultEndpointsProtocol=https;AccountName=mystorage;AccountKey=abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz01==';
      expect(redactSecrets(raw)).toContain('[REDACTED]');
    });

    it('redacts npm auth tokens', () => {
      const raw = '//registry.npmjs.org/:_authToken=npm_abc123def456';
      expect(redactSecrets(raw)).toContain('[REDACTED]');
    });

    it('redacts Heroku API keys', () => {
      const raw = 'HEROKU::abc12345-def67-8901-ghij-klmnopqrstuv';
      expect(redactSecrets(raw)).toContain('[REDACTED]');
    });
  });

  describe('Bearer and inline credentials', () => {
    it('redacts Bearer tokens in Authorization headers', () => {
      const input =
        'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozwN4i3i2o6vJk3n8YcQw';
      expect(redactSecrets(input)).toContain('[REDACTED]');
    });

    it('redacts Basic auth headers', () => {
      const input = 'Authorization: Basic dXNlcjpwYXNzd29yZA==';
      expect(redactSecrets(input)).toContain('[REDACTED]');
    });

    it('redacts inline password assignments', () => {
      expect(redactSecrets('password = "super-secret-123"')).toContain('[REDACTED]');
      expect(redactSecrets("secret: 'my-secret-value'")).toContain('[REDACTED]');
      expect(redactSecrets('api_key = "some-key-here"')).toContain('[REDACTED]');
    });

    it('redacts inline token assignments without quotes', () => {
      expect(redactSecrets('token=ghp_abc123def456ghi789jkl012mno345pqr678')).toContain(
        '[REDACTED]',
      );
    });
  });

  describe('preservation and edge cases', () => {
    it('preserves normal log lines without secrets', () => {
      const input = 'INFO: Pod started successfully on node worker-3';
      expect(redactSecrets(input)).toBe(input);
    });

    it('preserves normal deployment YAML without secrets', () => {
      const input = 'replicas: 3\n  image: nginx:1.25\n  ports:\n    - containerPort: 80';
      expect(redactSecrets(input)).toBe(input);
    });

    it('preserves normal URLs without credentials', () => {
      const inputs = [
        'https://example.com/api/v1/status',
        'http://localhost:3000/health',
        'https://docs.example.com/reference',
      ];
      for (const input of inputs) {
        expect(redactSecrets(input)).toBe(input);
      }
    });

    it('preserves normal error messages', () => {
      const inputs = [
        'Error: connect ECONNREFUSED 127.0.0.1:5432',
        'timeout: 30ms after 3 retries',
        'response status 503 Service Unavailable',
      ];
      for (const input of inputs) {
        expect(redactSecrets(input)).toBe(input);
      }
    });

    it('redacts multiple secrets across lines', () => {
      const ghToken = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd';
      const input = 'api_key = "key-123"\npassword: "pass-456"\n' + ghToken;
      const result = redactSecrets(input);
      const matches = result.match(/\[REDACTED\]/g);
      expect(matches?.length).toBeGreaterThanOrEqual(3);
    });

    it('handles empty string', () => {
      expect(redactSecrets('')).toBe('');
    });
  });
});

describe('redactEvidence', () => {
  it('redacts secrets in logs', () => {
    const ghToken = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd';
    const logs = ['log line with ' + ghToken];
    const metadata = { podName: 'test-pod', namespace: 'staging' };
    const result = redactEvidence(logs, metadata);
    expect(result.logs[0]).toContain('[REDACTED]');
    expect(result.logs[0]).not.toContain('ghp_');
  });

  it('redacts secrets in metadata values', () => {
    const logs: string[] = [];
    const metadata = {
      apiKey: 'sk-or-v1-abcdefghijklmnopqrstuvwxyz0123456789abcdef',
      env: 'staging',
    };
    const result = redactEvidence(logs, metadata);
    expect(result.metadata.apiKey).toContain('[REDACTED]');
    expect(result.metadata.apiKey).not.toContain('sk-or-v1');
    expect(result.metadata.env).toBe('staging');
  });

  it('redacts secrets in nested metadata', () => {
    const logs: string[] = [];
    const metadata = {
      cluster: 'prod-1',
      credentials: {
        token: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd',
        url: 'postgresql://admin:secret@db.internal/production',
      },
      labels: { app: 'api', team: 'platform' },
    };
    const result = redactEvidence(logs, metadata);
    const creds = result.metadata.credentials as Record<string, unknown>;
    expect(creds.token).toContain('[REDACTED]');
    expect(creds.url).toContain('[REDACTED]');
    expect(result.metadata.cluster).toBe('prod-1');
    expect((result.metadata.labels as Record<string, unknown>).app).toBe('api');
  });

  it('redacts secrets in metadata arrays', () => {
    const logs: string[] = [];
    const metadata = {
      urls: ['https://example.com', 'postgresql://user:pass@db.host/db', 'https://api.example.com'],
    };
    const result = redactEvidence(logs, metadata);
    const urls = result.metadata.urls as string[];
    expect(urls[0]).toBe('https://example.com');
    expect(urls[1]).toContain('[REDACTED]');
    expect(urls[2]).toBe('https://api.example.com');
  });

  it('returns a shallow clone of metadata', () => {
    const logs: string[] = [];
    const metadata = { podName: 'test-pod', namespace: 'staging' };
    const result = redactEvidence(logs, metadata);
    expect(result.metadata).toEqual(metadata);
    expect(result.metadata).not.toBe(metadata);
  });

  it('preserves non-string metadata values', () => {
    const logs: string[] = [];
    const metadata = { count: 42, active: true, ratio: 3.14, tags: null };
    const result = redactEvidence(logs, metadata);
    expect(result.metadata.count).toBe(42);
    expect(result.metadata.active).toBe(true);
    expect(result.metadata.ratio).toBe(3.14);
    expect(result.metadata.tags).toBeNull();
  });
});
