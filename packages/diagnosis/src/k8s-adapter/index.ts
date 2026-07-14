import type { K8sAdapter } from './types.js';
export type {
  K8sAdapter,
  Pod,
  Event,
  Deployment,
  PodPhase,
  PodStatus,
  ContainerStatus,
} from './types.js';
export type { K8sConfig } from './config.js';
export { RealK8sAdapter, K8sApiError } from './real.js';

let currentAdapter: K8sAdapter | null = null;

export function setK8sAdapter(adapter: K8sAdapter): void {
  currentAdapter = adapter;
}

export function getK8sAdapter(): K8sAdapter | null {
  return currentAdapter;
}
