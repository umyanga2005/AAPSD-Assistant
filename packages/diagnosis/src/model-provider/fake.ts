import type { ModelProvider } from './types.js';

export class FakeModelProvider implements ModelProvider {
  async generate(_prompt: string): Promise<unknown> {
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
}
