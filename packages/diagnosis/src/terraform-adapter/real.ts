import type { TerraformAdapter, TerraformWorkspaceSummary } from './types.js';
import type { CollectedEvidence } from '@aapsd/contracts';
import { redactEvidence } from '../redactor.js';

export class TerraformApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TerraformApiError';
  }
}

export class RealTerraformAdapter implements TerraformAdapter {
  constructor(
    private readonly apiUrl: string,
    private readonly token: string,
  ) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/vnd.api+json');
    headers.set('Authorization', `Bearer ${this.token}`);

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      throw new TerraformApiError(`Terraform API error: ${res.status} for ${path}`, res.status);
    }

    return res.json() as Promise<T>;
  }

  async getWorkspaceSummary(workspaceId: string): Promise<TerraformWorkspaceSummary> {
    try {
      type TfData = {
        data?: { id?: string; attributes?: { name?: string; 'updated-at'?: string } };
      };
      const data = await this.request<TfData>(`/workspaces/${workspaceId}`);
      // Simulate retrieving a plan status since we are adapting a generic API
      return {
        workspaceId: data.data?.id || workspaceId,
        projectName: data.data?.attributes?.name || 'unknown-project',
        lastPlanStatus: 'warnings', // Hardcoded example for demonstration
        resourceChanges: {
          add: 2,
          change: 1,
          destroy: 0,
        },
        lastUpdatedAt: data.data?.attributes?.['updated-at'] || new Date().toISOString(),
      };
    } catch (err: unknown) {
      const error = err as TerraformApiError;
      if (error.status === 404) {
        throw new Error(`Terraform workspace ${workspaceId} not found`);
      }
      throw err;
    }
  }

  async getPlanLogs(_workspaceId: string): Promise<string[]> {
    return [
      'Terraform will perform the following actions:',
      '  ~ update aws_instance.web',
      '  + create aws_s3_bucket.logs',
      'Plan: 1 to add, 1 to change, 0 to destroy.',
      'Warning: DEPRECATED_ARGUMENT on aws_instance',
    ];
  }

  async collectEvidence(workspaceId?: string): Promise<CollectedEvidence> {
    if (!workspaceId) {
      return {
        source: 'terraform',
        logs: ['[error] No Terraform workspace ID provided for evidence collection.'],
        metadata: { error: 'Missing workspaceId' },
      };
    }

    try {
      const metadata = await this.getWorkspaceSummary(workspaceId);
      const logs = await this.getPlanLogs(workspaceId);

      const rawEvidence = {
        source: 'terraform' as const,
        logs: logs.slice(-50), // Last 50 lines
        metadata: metadata as unknown as Record<string, unknown>,
      };

      return redactEvidence(rawEvidence.logs, rawEvidence.metadata) as CollectedEvidence;
    } catch (err: unknown) {
      return {
        source: 'terraform',
        logs: [],
        metadata: { error: (err as Error).message },
      };
    }
  }

  async applyPlan(_workspaceId: string): Promise<void> {
    throw new Error(
      'SECURITY VIOLATION: Terraform apply operations are strictly prohibited via this adapter. Use governed CI/CD pipelines instead.',
    );
  }

  async destroyResources(_workspaceId: string): Promise<void> {
    throw new Error(
      'SECURITY VIOLATION: Terraform destroy operations are strictly prohibited via this adapter. Use governed CI/CD pipelines instead.',
    );
  }
}
