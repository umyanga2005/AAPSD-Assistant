import { describe, it, expect } from 'vitest';
import { redactSecrets, redactEvidence } from '../src/redactor.js';

describe('redactSecrets', () => {
  it('redacts RSA private keys', () => {
    const input = `-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----`;
    const result = redactSecrets(input);
    expect(result).not.toContain('MIIEpAIBAAKCAQEA');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts GitHub tokens', () => {
    const ghPrefix = 'ghp_';
    const input = ghPrefix + 'abcdefghijklmnopqrstuvwxyz0123456789abcd';
    const result = redactSecrets(input);
    expect(result).not.toContain(ghPrefix);
    expect(result).toContain('[REDACTED]');
  });

  it('redacts AWS access keys', () => {
    const awsPrefix = 'AKIA';
    const input = awsPrefix + 'IOSFODNN7EXAMPLE';
    const result = redactSecrets(input);
    expect(result).not.toContain(awsPrefix);
    expect(result).toContain('[REDACTED]');
  });

  it('redacts OpenAI-style API keys', () => {
    const skPrefix = 'sk-proj-';
    const input = skPrefix + 'abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnop';
    const result = redactSecrets(input);
    expect(result).not.toContain(skPrefix);
    expect(result).toContain('[REDACTED]');
  });

  it('redacts Slack tokens', () => {
    const prefix = 'xoxb-';
    const input = prefix + '1234567890-abcdefghijklmnopqrstuvwxyz';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
  });

  it('redacts inline password assignments', () => {
    const input1 = 'password = "super-secret-123"';
    const input2 = 'secret: "my-secret-value"';
    const input3 = 'api_key = "some-key-here"';
    expect(redactSecrets(input1)).toContain('[REDACTED]');
    expect(redactSecrets(input2)).toContain('[REDACTED]');
    expect(redactSecrets(input3)).toContain('[REDACTED]');
  });

  it('redacts Bearer tokens in Authorization headers', () => {
    const input =
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozwN4i3i2o6vJk3n8YcQw';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
  });

  it('preserves normal log lines without secrets', () => {
    const input = 'INFO: Pod started successfully on node worker-3';
    expect(redactSecrets(input)).toBe(input);
  });

  it('preserves normal deployment YAML without secrets', () => {
    const input = 'replicas: 3\n  image: nginx:1.25\n  ports:\n    - containerPort: 80';
    expect(redactSecrets(input)).toBe(input);
  });

  it('redacts multiple secrets across lines', () => {
    const ghToken = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789abcd';
    const input = 'api_key = "key-123"\npassword: "pass-456"\n' + ghToken;
    const result = redactSecrets(input);
    const matches = result.match(/\[REDACTED\]/g);
    expect(matches?.length).toBeGreaterThanOrEqual(3);
  });

  it('handles empty string', () => {
    expect(redactSecrets('')).toBe('');
  });
});

describe('redactEvidence', () => {
  it('redacts logs and returns metadata unmodified', () => {
    const ghToken = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789abcd';
    const logs = ['log line with ' + ghToken];
    const metadata = { podName: 'test-pod', namespace: 'staging' };
    const result = redactEvidence(logs, metadata);
    expect(result.logs[0]).toContain('[REDACTED]');
    expect(result.logs[0]).not.toContain('ghp_');
    expect(result.metadata).toEqual(metadata);
    expect(result.metadata).not.toBe(metadata);
  });
});
