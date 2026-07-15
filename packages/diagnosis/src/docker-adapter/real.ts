import type { DockerAdapter, DockerImageMetadata } from './types.js';
import type { CollectedEvidence } from '@aapsd/contracts';
import { redactEvidence } from '../redactor.js';

export class DockerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'DockerApiError';
  }
}

export class RealDockerAdapter implements DockerAdapter {
  constructor(private readonly daemonUrl: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.daemonUrl}${path}`;
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      throw new DockerApiError(`Docker API error: ${res.status} for ${path}`, res.status);
    }

    // Sometimes logs endpoints return text, but metadata returns JSON
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json() as Promise<T>;
    } else {
      return res.text() as unknown as Promise<T>;
    }
  }

  async getImageMetadata(imageId: string): Promise<DockerImageMetadata> {
    try {
      type DockerData = { Id?: string; RepoTags?: string[]; Size?: number; Created?: string };
      const data = await this.request<DockerData>(`/images/${imageId}/json`);
      return {
        id: data.Id || imageId,
        tags: data.RepoTags || [],
        size: data.Size || 0,
        created: data.Created || new Date().toISOString(),
        buildStatus: 'success', // Simplified for read-only metadata
      };
    } catch (err: unknown) {
      const error = err as DockerApiError;
      if (error.status === 404) {
        throw new Error(`Docker image ${imageId} not found`);
      }
      throw err;
    }
  }

  async getBuildLogs(_imageId: string): Promise<string[]> {
    return ['[Build logs would be retrieved from staging builder here]'];
  }

  async collectEvidence(imageId?: string): Promise<CollectedEvidence> {
    if (!imageId) {
      return {
        source: 'docker',
        logs: ['[error] No Docker image ID provided for evidence collection.'],
        metadata: { error: 'Missing imageId' },
      };
    }

    try {
      const metadata = await this.getImageMetadata(imageId);
      const logs = await this.getBuildLogs(imageId);

      const rawEvidence = {
        source: 'docker' as const,
        logs: logs.slice(-50), // Last 50 lines
        metadata: metadata as unknown as Record<string, unknown>,
      };

      return redactEvidence(rawEvidence.logs, rawEvidence.metadata) as CollectedEvidence;
    } catch (err: unknown) {
      return {
        source: 'docker',
        logs: [],
        metadata: { error: (err as Error).message },
      };
    }
  }

  async runCommand(_command: string): Promise<void> {
    throw new Error(
      'SECURITY VIOLATION: Arbitrary Docker commands are strictly prohibited in this environment.',
    );
  }

  async buildImage(_path: string): Promise<void> {
    throw new Error(
      'SECURITY VIOLATION: Docker mutations (build/push/rmi) are strictly prohibited in this environment.',
    );
  }
}
