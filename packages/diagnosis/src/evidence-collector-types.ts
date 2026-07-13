import type { CollectedEvidence } from '@aapsd/contracts';

export interface EvidenceCollectorOptions {
  pipelineRunId?: string;
  podName?: string;
  timeRange?: { start: string; end: string };
}

export interface EvidenceCollector {
  collectAll(options: EvidenceCollectorOptions): Promise<CollectedEvidence[]>;
}
