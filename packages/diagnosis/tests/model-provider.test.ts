import { describe, it, expect, vi, afterEach } from 'vitest';
import { FakeModelProvider, OpenRouterModelProvider } from '../src/model-provider/index.js';
import { validateModelResponse } from '../src/analyzer.js';
import { analyzeWithModel } from '../src/analyzer.js';
import type { ModelProvider } from '../src/model-provider/types.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FakeModelProvider', () => {
  it('returns a deterministic valid response', async () => {
    const provider = new FakeModelProvider();
    const raw = await provider.generate('test');
    const result = validateModelResponse(raw);
    expect(result.summary).toContain('staging deployment failed');
    expect(result.confidence).toBe('high');
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.likely_causes.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.needs_human_review).toBe(false);
  });

  it('ignores the prompt and returns the same summary', async () => {
    const provider = new FakeModelProvider();
    const a = await provider.generate('Why did it fail?');
    const b = await provider.generate('What happened?');
    const sa = a as Record<string, unknown>;
    const sb = b as Record<string, unknown>;
    expect(sa.summary).toBe(sb.summary);
    expect(sa.confidence).toBe(sb.confidence);
  });
});

describe('OpenRouterModelProvider', () => {
  it('throws when no API key is configured', () => {
    const key = process.env.GROQ_API_KEY;
    vi.stubEnv('GROQ_API_KEY', '');
    expect(() => new OpenRouterModelProvider()).toThrow(
      'GROQ_API_KEY environment variable is required',
    );
    vi.unstubAllEnvs();
  });

  it('accepts explicit options without env vars', () => {
    const provider = new OpenRouterModelProvider({
      apiKey: 'sk-test',
      model: 'test-model',
      timeoutMs: 5_000,
    });
    expect(provider).toBeDefined();
  });
});

describe('timeout', () => {
  it('analyzeWithModel rejects when model takes too long', async () => {
    const slowProvider: ModelProvider = {
      generate: () => new Promise<unknown>((resolve) => setTimeout(() => resolve(null), 500)),
    };

    await expect(analyzeWithModel('test', slowProvider, 30)).rejects.toThrow(
      'Model request timed out',
    );
  });
});

describe('malformed output', () => {
  it('validateModelResponse rejects null', () => {
    expect(() => validateModelResponse(null)).toThrow('non-object');
  });

  it('validateModelResponse rejects missing fields', () => {
    expect(() =>
      validateModelResponse({
        summary: 'test',
        evidence: [],
        likely_causes: [],
        recommendations: [],
        confidence: 'high',
      }),
    ).toThrow('missing required field');
  });

  it('validateModelResponse rejects invalid confidence', () => {
    expect(() =>
      validateModelResponse({
        summary: 'test',
        evidence: [],
        likely_causes: [],
        recommendations: [],
        confidence: 'unknown',
        needs_human_review: false,
      }),
    ).toThrow('invalid confidence');
  });
});

describe('missing configuration', () => {
  it('FakeModelProvider works without any env vars', async () => {
    const provider = new FakeModelProvider();
    const raw = await provider.generate('query without env');
    expect(raw).toBeDefined();
    expect(typeof raw).toBe('object');
  });

  it('analyzeWithModel uses FakeModelProvider by default', async () => {
    const result = await analyzeWithModel('no-provider test');
    expect(result.summary).toBeDefined();
    expect(result.confidence).toBeDefined();
  });
});
