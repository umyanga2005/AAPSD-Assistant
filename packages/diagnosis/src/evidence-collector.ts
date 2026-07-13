import type { CollectedEvidence } from '@aapsd/contracts';

export async function collectGitHubEvidence(_pipelineRunId?: string): Promise<CollectedEvidence> {
  return {
    source: 'github',
    logs: ['[stub] GitHub Actions logs not yet connected'],
    metadata: { pipelineRunId: _pipelineRunId ?? null },
  };
}

export async function collectKubernetesEvidence(_podName?: string): Promise<CollectedEvidence> {
  return {
    source: 'kubernetes',
    logs: ['[stub] Kubernetes pod logs not yet connected'],
    metadata: { podName: _podName ?? null },
  };
}

export async function collectPrometheusEvidence(_timeRange?: {
  start: string;
  end: string;
}): Promise<CollectedEvidence> {
  return {
    source: 'prometheus',
    logs: ['[stub] Prometheus metrics not yet connected'],
    metadata: { timeRange: _timeRange ?? null },
  };
}

export async function collectAllEvidence(
  pipelineRunId?: string,
  podName?: string,
  timeRange?: { start: string; end: string },
): Promise<CollectedEvidence[]> {
  const results = await Promise.all([
    collectGitHubEvidence(pipelineRunId),
    collectKubernetesEvidence(podName),
    collectPrometheusEvidence(timeRange),
  ]);
  return results;
}
