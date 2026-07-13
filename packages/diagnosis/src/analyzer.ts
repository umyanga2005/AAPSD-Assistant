import type { ModelResponse } from '@aapsd/contracts';
import type { ModelProvider } from './model-provider/types.js';
import { FakeModelProvider } from './model-provider/fake.js';

const REQUIRED_FIELDS: (keyof ModelResponse)[] = [
  'summary',
  'evidence',
  'likely_causes',
  'recommendations',
  'confidence',
  'needs_human_review',
];

export function validateModelResponse(raw: unknown): ModelResponse {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Model returned non-object response');
  }

  const obj = raw as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      throw new Error(`Model response missing required field: "${field}"`);
    }
  }

  const validConfidences: string[] = ['high', 'medium', 'low', 'insufficient_evidence'];
  const confidence = obj.confidence as string;
  if (!validConfidences.includes(confidence)) {
    throw new Error(`Model response has invalid confidence: "${confidence}"`);
  }

  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) {
    throw new Error('Model response summary must be a non-empty string');
  }

  if (!Array.isArray(obj.evidence)) {
    throw new Error('Model response evidence must be an array');
  }

  if (!Array.isArray(obj.likely_causes)) {
    throw new Error('Model response likely_causes must be an array');
  }

  if (!Array.isArray(obj.recommendations)) {
    throw new Error('Model response recommendations must be an array');
  }

  if (typeof obj.needs_human_review !== 'boolean') {
    throw new Error('Model response needs_human_review must be a boolean');
  }

  return obj as unknown as ModelResponse;
}

export async function analyzeWithModel(
  prompt: string,
  provider?: ModelProvider,
  timeoutMs: number = 30_000,
): Promise<ModelResponse> {
  const resolvedProvider: ModelProvider = provider ?? new FakeModelProvider();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Model request timed out')), timeoutMs),
  );

  const modelPromise = resolvedProvider.generate(prompt);

  const raw = await Promise.race([modelPromise, timeoutPromise]);

  return validateModelResponse(raw);
}
