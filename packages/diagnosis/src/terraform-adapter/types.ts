import type { CollectedEvidence } from '@aapsd/contracts';

export interface TerraformWorkspaceSummary {
  workspaceId: string;
  projectName: string;
  lastPlanStatus: 'clean' | 'warnings' | 'drift_detected' | 'failed';
  resourceChanges: {
    add: number;
    change: number;
    destroy: number;
  };
  lastUpdatedAt: string;
}

export interface TerraformAdapter {
  collectEvidence(workspaceId?: string): Promise<CollectedEvidence>;
  getWorkspaceSummary(workspaceId: string): Promise<TerraformWorkspaceSummary>;
  getPlanLogs(workspaceId: string): Promise<string[]>;
  // Explicitly rejected mutation methods
  applyPlan(workspaceId: string): Promise<void>;
  destroyResources(workspaceId: string): Promise<void>;
}
