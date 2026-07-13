export type EvidenceSource = 'github' | 'kubernetes' | 'prometheus' | 'runbook';

export type Confidence = 'high' | 'medium' | 'low' | 'insufficient_evidence';

export interface EvidenceItem {
  source: EvidenceSource;
  title: string;
  detail: string;
  url?: string;
  timestamp?: string;
}

export interface Cause {
  description: string;
  probability: number;
}

export interface Recommendation {
  action: string;
  details: string;
}

export interface DiagnosisResult {
  requestId: string;
  summary: string;
  evidence: EvidenceItem[];
  likely_causes: Cause[];
  recommendations: Recommendation[];
  confidence: Confidence;
  needs_human_review: boolean;
  redacted: boolean;
  traceId: string;
}

export interface DiagnosisRequest {
  userId: string;
  projectId: string;
  environmentId: string;
  query: string;
  traceId: string;
  context?: {
    pipelineRunId?: string;
    podName?: string;
    timeRange?: { start: string; end: string };
  };
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
}

export interface CollectedEvidence {
  source: EvidenceSource;
  logs: string[];
  metadata: Record<string, unknown>;
}

export interface RunbookEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

export interface ModelResponse {
  summary: string;
  evidence: EvidenceItem[];
  likely_causes: Cause[];
  recommendations: Recommendation[];
  confidence: Confidence;
  needs_human_review: boolean;
}
