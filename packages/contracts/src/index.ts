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

export type ActionType =
  'github.workflow.dispatch' | 'kubernetes.deployment.restart' | 'kubernetes.deployment.scale';

export interface GitHubWorkflowDispatchArgs {
  repo: string;
  workflowId: string;
  ref: string;
  inputs?: Record<string, string>;
}

export interface KubernetesDeploymentRestartArgs {
  namespace: string;
  deploymentName: string;
}

export interface KubernetesDeploymentScaleArgs {
  namespace: string;
  deploymentName: string;
  replicas: number;
}

export type ActionArgs =
  GitHubWorkflowDispatchArgs | KubernetesDeploymentRestartArgs | KubernetesDeploymentScaleArgs;

export type ActionPlanStatus =
  'pending' | 'approved' | 'rejected' | 'expired' | 'executed' | 'failed';

export interface ActionPlan {
  id: string;
  projectId: string;
  environmentId: string;
  actionType: ActionType;
  typedArgs: ActionArgs;
  status: ActionPlanStatus;
  actorId: string;
  approverId?: string | null;
  policyResult?: Record<string, unknown> | null;
  traceId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionPlanRequest {
  projectId: string;
  environmentId: string;
  actionType: ActionType;
  typedArgs: ActionArgs;
}
