import type { DockerAdapter } from './types.js';
export type { DockerAdapter, DockerImageMetadata } from './types.js';
export { RealDockerAdapter, DockerApiError } from './real.js';

let currentAdapter: DockerAdapter | null = null;

export function setDockerAdapter(adapter: DockerAdapter): void {
  currentAdapter = adapter;
}

export function getDockerAdapter(): DockerAdapter | null {
  return currentAdapter;
}
