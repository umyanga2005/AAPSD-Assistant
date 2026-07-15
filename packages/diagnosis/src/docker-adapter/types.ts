import type { CollectedEvidence } from '@aapsd/contracts';

export interface DockerImageMetadata {
  id: string;
  tags: string[];
  size: number;
  created: string;
  buildStatus: 'success' | 'failure' | 'building';
  buildLogs?: string[];
}

export interface DockerAdapter {
  collectEvidence(imageId?: string): Promise<CollectedEvidence>;
  getImageMetadata(imageId: string): Promise<DockerImageMetadata>;
  getBuildLogs(imageId: string): Promise<string[]>;
  // Explicitly rejected mutation methods
  runCommand(command: string): Promise<void>;
  buildImage(path: string): Promise<void>;
}
