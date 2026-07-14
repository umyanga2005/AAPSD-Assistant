import type { GitHubAdapter } from './types.js';
export type { GitHubAdapter, WorkflowRun, Job, Step } from './types.js';
export type { GitHubConfig } from './config.js';
export { RealGitHubAdapter, GitHubApiError } from './real.js';

let currentAdapter: GitHubAdapter | null = null;

export function setGitHubAdapter(adapter: GitHubAdapter): void {
  currentAdapter = adapter;
}

export function getGitHubAdapter(): GitHubAdapter | null {
  return currentAdapter;
}
