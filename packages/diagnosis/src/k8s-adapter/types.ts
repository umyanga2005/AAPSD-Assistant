import type { CollectedEvidence } from '@aapsd/contracts';

export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';

export type PodStatus = 'True' | 'False' | 'Unknown';

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state: string;
  started?: boolean;
}

export interface Pod {
  name: string;
  namespace: string;
  phase: PodPhase;
  status: PodStatus;
  containers: ContainerStatus[];
  nodeName?: string;
  podIP?: string;
  createdAt: string;
}

export interface Event {
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  source: string;
  firstTimestamp: string;
  lastTimestamp: string;
  count: number;
  involvedObject: string;
}

export interface Deployment {
  name: string;
  namespace: string;
  replicas: number;
  availableReplicas: number;
  readyReplicas: number;
  updatedReplicas: number;
  strategy: string;
  conditions: string[];
  createdAt: string;
}

export interface K8sAdapter {
  collectEvidence(podName?: string, namespace?: string): Promise<CollectedEvidence>;
  getPodStatus(namespace: string, podName: string): Promise<Pod>;
  getEvents(namespace: string, podName?: string): Promise<Event[]>;
  getPodLogs(namespace: string, podName: string, tailLines?: number): Promise<string[]>;
  getDeployments(namespace: string): Promise<Deployment[]>;
}
