import { describe, it, expect } from 'vitest';
import { runDiagnosis } from '../src/workflow.js';

describe('runDiagnosis', () => {
  const validRequest = {
    userId: 'user-1',
    projectId: 'project-1',
    environmentId: 'staging',
    query: 'Why did the deployment fail?',
    traceId: 'trace-001',
  };

  it('returns authorized diagnosis result for viewer role', async () => {
    const result = await runDiagnosis(validRequest, ['viewer']);
    expect(result).toHaveProperty('requestId', 'trace-001');
    expect(result).toHaveProperty('traceId', 'trace-001');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('confidence');
    expect(result.redacted).toBe(true);
  });

  it('returns authorized diagnosis result for developer role', async () => {
    const result = await runDiagnosis(validRequest, ['developer']);
    expect(result).not.toHaveProperty('reason');
    expect(result.confidence).not.toBe('insufficient_evidence');
  });

  it('returns insufficient_evidence when unauthorized', async () => {
    const result = await runDiagnosis(validRequest, []);
    expect(result.confidence).toBe('insufficient_evidence');
    expect(result.summary).toContain('Authorization failed');
    expect(result.needs_human_review).toBe(true);
  });

  it('returns insufficient_evidence when request is missing fields', async () => {
    const result = await runDiagnosis(
      { userId: '', projectId: '', environmentId: '', query: '', traceId: 't2' },
      ['viewer'],
    );
    expect(result.confidence).toBe('insufficient_evidence');
    expect(result.summary).toContain('Authorization failed');
  });

  it('includes evidence and recommendations on success', async () => {
    const result = await runDiagnosis(validRequest, ['viewer']);
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });
});
