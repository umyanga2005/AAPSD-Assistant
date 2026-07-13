import type { ModelResponse } from '@aapsd/contracts';

export interface AnalyzerConfig {
  timeoutMs: number;
}

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

async function defaultModelFn(): Promise<unknown> {
  return {
    summary: 'The latest staging deployment failed because the container image was not found.',
    evidence: [
      {
        source: 'github',
        title: 'GitHub Actions job failure',
        detail: 'Job "Deploy" failed at step "Pull image" with exit code 1.',
        url: 'https://github.com/org/repo/actions/runs/123',
      },
      {
        source: 'kubernetes',
        title: 'ImagePullBackOff',
        detail: 'Pod api-7d8f9b pod in ImagePullBackOff state.',
        timestamp: new Date().toISOString(),
      },
    ],
    likely_causes: [
      { description: 'Container image tag does not exist in registry', probability: 0.85 },
      { description: 'Image registry authentication expired', probability: 0.12 },
    ],
    recommendations: [
      {
        action: 'Verify image build pipeline',
        details: 'Check if the image build/push job completed successfully for the expected tag.',
      },
      {
        action: 'Check registry credentials',
        details: 'Verify that the Kubernetes pull secret is valid and not expired.',
      },
    ],
    confidence: 'high',
    needs_human_review: false,
  };
}

export async function analyzeWithModel(
  prompt: string,
  config: AnalyzerConfig = { timeoutMs: 30_000 },
  modelFn: () => Promise<unknown> = defaultModelFn,
): Promise<ModelResponse> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Model request timed out')), config.timeoutMs),
  );

  const modelPromise = modelFn();

  const raw = await Promise.race([modelPromise, timeoutPromise]);

  return validateModelResponse(raw);
}
