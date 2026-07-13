import { describe, it, expect } from 'vitest';
import { runDiagnosis } from '../src/workflow.js';
import type {
  EvidenceCollector,
  EvidenceCollectorOptions,
} from '../src/evidence-collector-types.js';
import type { CollectedEvidence } from '@aapsd/contracts';

describe('runDiagnosis', () => {
  const validRequest = {
    userId: 'user-1',
    projectId: 'project-1',
    environmentId: 'staging',
    query: 'Why did the deployment fail?',
    traceId: 'trace-001',
    context: {
      pipelineRunId: 'run-123',
      podName: 'api-7d8f9b',
      timeRange: { start: '2025-01-01T00:00:00Z', end: '2025-01-02T00:00:00Z' },
    },
  };

  function stubCollector(overrides?: Partial<CollectedEvidence>): EvidenceCollector {
    return {
      async collectAll(_options: EvidenceCollectorOptions): Promise<CollectedEvidence[]> {
        return [
          {
            source: 'github',
            logs: ['Build failed at step "Deploy"'],
            metadata: { pipelineRunId: 'run-123' },
            ...overrides,
          },
        ];
      },
    };
  }

  it('returns authorized diagnosis result for viewer role', async () => {
    const result = await runDiagnosis(validRequest, ['viewer'], undefined, stubCollector());
    expect(result).toHaveProperty('requestId', 'trace-001');
    expect(result).toHaveProperty('traceId', 'trace-001');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('confidence');
    expect(result.redacted).toBe(true);
  });

  it('returns authorized diagnosis result for developer role', async () => {
    const result = await runDiagnosis(validRequest, ['developer'], undefined, stubCollector());
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
    const result = await runDiagnosis(validRequest, ['viewer'], undefined, stubCollector());
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('returns insufficient_evidence when no context is provided', async () => {
    const result = await runDiagnosis(
      {
        userId: 'user-1',
        projectId: 'project-1',
        environmentId: 'staging',
        query: 'Why did the deployment fail?',
        traceId: 't3',
      },
      ['viewer'],
    );
    expect(result.confidence).toBe('insufficient_evidence');
    expect(result.summary).toContain('No context provided');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.redacted).toBe(false);
  });

  it('returns insufficient_evidence when evidence collector returns empty logs', async () => {
    const emptyCollector: EvidenceCollector = {
      async collectAll(_options: EvidenceCollectorOptions): Promise<CollectedEvidence[]> {
        return [{ source: 'github', logs: [], metadata: {} }];
      },
    };
    const result = await runDiagnosis(validRequest, ['viewer'], undefined, emptyCollector);
    expect(result.confidence).toBe('insufficient_evidence');
    expect(result.summary).toContain('No usable evidence');
  });

  it('collects only requested evidence sources based on context fields', async () => {
    const collectedOptions: EvidenceCollectorOptions[] = [];
    const selectiveCollector: EvidenceCollector = {
      async collectAll(options: EvidenceCollectorOptions): Promise<CollectedEvidence[]> {
        collectedOptions.push({ ...options });
        const results: CollectedEvidence[] = [];
        if (options.pipelineRunId) {
          results.push({
            source: 'github',
            logs: ['GitHub log'],
            metadata: { pipelineRunId: options.pipelineRunId },
          });
        }
        if (options.podName) {
          results.push({
            source: 'kubernetes',
            logs: ['K8s log'],
            metadata: { podName: options.podName },
          });
        }
        if (options.timeRange) {
          results.push({
            source: 'prometheus',
            logs: ['Prometheus log'],
            metadata: { timeRange: options.timeRange },
          });
        }
        return results;
      },
    };

    const result = await runDiagnosis(
      {
        userId: 'user-1',
        projectId: 'project-1',
        environmentId: 'staging',
        query: 'debug',
        traceId: 't4',
        context: { pipelineRunId: 'run-456', podName: 'pod-abc' },
      },
      ['viewer'],
      undefined,
      selectiveCollector,
    );

    expect(collectedOptions.length).toBe(1);
    expect(collectedOptions[0].pipelineRunId).toBe('run-456');
    expect(collectedOptions[0].podName).toBe('pod-abc');
    expect(collectedOptions[0].timeRange).toBeUndefined();
    expect(result.confidence).not.toBe('insufficient_evidence');
  });

  it('continues diagnosis when one evidence source fails', async () => {
    const failingCollector: EvidenceCollector = {
      async collectAll(_options: EvidenceCollectorOptions): Promise<CollectedEvidence[]> {
        return [
          {
            source: 'github',
            logs: [],
            metadata: { error: 'GitHub evidence unavailable: API rate limit exceeded' },
          },
          {
            source: 'kubernetes',
            logs: ['Pod is crashing loop back off'],
            metadata: { podName: 'pod-xyz' },
          },
        ];
      },
    };

    const result = await runDiagnosis(validRequest, ['viewer'], undefined, failingCollector);
    expect(result.confidence).not.toBe('insufficient_evidence');
    expect(result.summary).toBeTruthy();
  });

  it('uses the default evidence collector when none is provided', async () => {
    const result = await runDiagnosis(validRequest, ['viewer']);
    expect(result.confidence).not.toBe('insufficient_evidence');
    expect(result.redacted).toBe(true);
  });
});
