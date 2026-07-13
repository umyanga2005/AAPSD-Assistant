import { describe, it, expect } from 'vitest';
import { analyzeWithModel, validateModelResponse } from '../src/analyzer.js';
import { FakeModelProvider } from '../src/model-provider/fake.js';
import type { ModelProvider } from '../src/model-provider/types.js';

const fakeProvider = new FakeModelProvider();

describe('analyzeWithModel', () => {
  it('returns a valid ModelResponse on success', async () => {
    const result = await analyzeWithModel('Why did deployment fail?', fakeProvider);
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('evidence');
    expect(result).toHaveProperty('likely_causes');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('needs_human_review');
    expect(['high', 'medium', 'low', 'insufficient_evidence']).toContain(result.confidence);
    expect(typeof result.needs_human_review).toBe('boolean');
  });
});

describe('malformed model output', () => {
  it('throws when model returns non-object', () => {
    expect(() => validateModelResponse('string')).toThrow('non-object');
    expect(() => validateModelResponse(null)).toThrow('non-object');
    expect(() => validateModelResponse(undefined)).toThrow('non-object');
    expect(() => validateModelResponse(123)).toThrow('non-object');
  });

  it('throws when model response is missing required fields', () => {
    expect(() => validateModelResponse({})).toThrow('missing required field');
    expect(() =>
      validateModelResponse({
        summary: 'test',
        evidence: [],
        likely_causes: [],
        recommendations: [],
        confidence: 'high',
      }),
    ).toThrow('missing required field: "needs_human_review"');
  });

  it('throws when confidence is invalid', () => {
    expect(() =>
      validateModelResponse({
        summary: 'test',
        evidence: [],
        likely_causes: [],
        recommendations: [],
        confidence: 'very_high',
        needs_human_review: false,
      }),
    ).toThrow('invalid confidence');
  });

  it('throws when summary is empty', () => {
    expect(() =>
      validateModelResponse({
        summary: '',
        evidence: [],
        likely_causes: [],
        recommendations: [],
        confidence: 'high',
        needs_human_review: false,
      }),
    ).toThrow('non-empty string');
  });

  it('throws when evidence is not an array', () => {
    expect(() =>
      validateModelResponse({
        summary: 'test',
        evidence: 'not-an-array',
        likely_causes: [],
        recommendations: [],
        confidence: 'high',
        needs_human_review: false,
      }),
    ).toThrow('evidence must be an array');
  });
});

describe('model timeout', () => {
  it('throws when request exceeds timeout', async () => {
    const slowProvider: ModelProvider = {
      generate: () =>
        new Promise<unknown>((resolve) => setTimeout(() => resolve({ summary: 'late' }), 500)),
    };

    await expect(analyzeWithModel('test', slowProvider, 50)).rejects.toThrow(
      'Model request timed out',
    );
  });
});
