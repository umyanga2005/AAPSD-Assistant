import type { CollectedEvidence } from '@aapsd/contracts';
import type { EvidenceCollector, EvidenceCollectorOptions } from './evidence-collector-types.js';
import { getGitHubAdapter } from './github-adapter/index.js';
import { getK8sAdapter } from './k8s-adapter/index.js';
import { getPrometheusAdapter } from './prometheus-adapter/index.js';
import { getDockerAdapter } from './docker-adapter/index.js';
import { getTerraformAdapter } from './terraform-adapter/index.js';

export type { EvidenceCollector, EvidenceCollectorOptions } from './evidence-collector-types.js';

export async function collectGitHubEvidence(pipelineRunId?: string): Promise<CollectedEvidence> {
  const adapter = getGitHubAdapter();
  if (adapter) {
    return adapter.collectEvidence(pipelineRunId ?? undefined);
  }

  return {
    source: 'github',
    logs: ['[stub] GitHub Actions logs not yet connected'],
    metadata: { pipelineRunId: pipelineRunId ?? null },
  };
}

export async function collectKubernetesEvidence(podName?: string): Promise<CollectedEvidence> {
  const adapter = getK8sAdapter();
  if (adapter) {
    return adapter.collectEvidence(podName ?? undefined);
  }

  return {
    source: 'kubernetes',
    logs: ['[stub] Kubernetes pod logs not yet connected'],
    metadata: { podName: podName ?? null },
  };
}

export async function collectPrometheusEvidence(timeRange?: {
  start: string;
  end: string;
}): Promise<CollectedEvidence> {
  const adapter = getPrometheusAdapter();
  if (adapter) {
    return adapter.collectEvidence(timeRange);
  }

  return {
    source: 'prometheus',
    logs: ['[stub] Prometheus metrics not yet connected'],
    metadata: { timeRange: timeRange ?? null },
  };
}

export async function collectDockerEvidence(imageId?: string): Promise<CollectedEvidence> {
  const adapter = getDockerAdapter();
  if (adapter) {
    return adapter.collectEvidence(imageId ?? undefined);
  }

  return {
    source: 'docker',
    logs: ['[stub] Docker logs not yet connected'],
    metadata: { dockerImageId: imageId ?? null },
  };
}

export async function collectTerraformEvidence(workspaceId?: string): Promise<CollectedEvidence> {
  const adapter = getTerraformAdapter();
  if (adapter) {
    return adapter.collectEvidence(workspaceId ?? undefined);
  }

  return {
    source: 'terraform',
    logs: ['[stub] Terraform logs not yet connected'],
    metadata: { terraformWorkspaceId: workspaceId ?? null },
  };
}

export async function collectAllEvidence(
  pipelineRunId?: string,
  podName?: string,
  timeRange?: { start: string; end: string },
  dockerImageId?: string,
  terraformWorkspaceId?: string,
): Promise<CollectedEvidence[]> {
  const results = await Promise.all([
    collectGitHubEvidence(pipelineRunId),
    collectKubernetesEvidence(podName),
    collectPrometheusEvidence(timeRange),
    collectDockerEvidence(dockerImageId),
    collectTerraformEvidence(terraformWorkspaceId),
  ]);
  return results;
}

export async function collectRequestedEvidence(
  options: EvidenceCollectorOptions,
): Promise<CollectedEvidence[]> {
  const promises: Array<Promise<CollectedEvidence>> = [];

  if (options.pipelineRunId) {
    promises.push(
      collectGitHubEvidence(options.pipelineRunId).catch((err: unknown) => ({
        source: 'github' as const,
        logs: [],
        metadata: { error: `GitHub evidence unavailable: ${(err as Error).message}` },
      })),
    );
  }

  if (options.podName) {
    promises.push(
      collectKubernetesEvidence(options.podName).catch((err: unknown) => ({
        source: 'kubernetes' as const,
        logs: [],
        metadata: { error: `Kubernetes evidence unavailable: ${(err as Error).message}` },
      })),
    );
  }

  if (options.timeRange) {
    promises.push(
      collectPrometheusEvidence(options.timeRange).catch((err: unknown) => ({
        source: 'prometheus' as const,
        logs: [],
        metadata: { error: `Prometheus evidence unavailable: ${(err as Error).message}` },
      })),
    );
  }

  if (options.dockerImageId) {
    promises.push(
      collectDockerEvidence(options.dockerImageId).catch((err: unknown) => ({
        source: 'docker' as const,
        logs: [],
        metadata: { error: `Docker evidence unavailable: ${(err as Error).message}` },
      })),
    );
  }

  if (options.terraformWorkspaceId) {
    promises.push(
      collectTerraformEvidence(options.terraformWorkspaceId).catch((err: unknown) => ({
        source: 'terraform' as const,
        logs: [],
        metadata: { error: `Terraform evidence unavailable: ${(err as Error).message}` },
      })),
    );
  }

  return Promise.all(promises);
}

export function createDefaultEvidenceCollector(): EvidenceCollector {
  return {
    async collectAll(options: EvidenceCollectorOptions): Promise<CollectedEvidence[]> {
      return collectRequestedEvidence(options);
    },
  };
}
