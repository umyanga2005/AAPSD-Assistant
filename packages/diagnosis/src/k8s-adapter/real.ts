import type { CollectedEvidence } from '@aapsd/contracts';
import type { K8sAdapter, Pod, Event, Deployment, PodPhase, PodStatus } from './types.js';
import type { K8sConfig } from './config.js';
import { redactSecrets } from '../redactor.js';
import { Agent } from 'undici';

export class K8sApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'K8sApiError';
  }
}

export class RealK8sAdapter implements K8sAdapter {
  private token: string;
  private apiServerUrl: string;
  private allowedNamespaces: string[];
  private dispatcher: Agent;

  constructor(config: K8sConfig) {
    if (!config.token) {
      throw new Error('K8S_TOKEN is required for RealK8sAdapter');
    }
    this.token = config.token;
    this.apiServerUrl = config.apiServerUrl ?? 'https://kubernetes.default.svc';
    this.allowedNamespaces = config.allowedNamespaces ?? [];
    this.dispatcher = new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    });
  }

  private checkNamespace(namespace: string): void {
    if (this.allowedNamespaces.length > 0 && !this.allowedNamespaces.includes(namespace)) {
      throw new K8sApiError(403, `Namespace "${namespace}" is not in the allowed list`);
    }
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.apiServerUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'User-Agent': 'aapsd-diagnosis',
      },
      dispatcher: this.dispatcher,
    } as any);

    if (!response.ok) {
      throw new K8sApiError(response.status, `K8s API error: ${response.status} for ${path}`);
    }

    return response.json() as Promise<T>;
  }

  async collectEvidence(podName?: string, namespace?: string): Promise<CollectedEvidence> {
    if (!podName) {
      return { source: 'kubernetes', logs: [], metadata: { note: 'No podName provided' } };
    }

    const targetNamespace = namespace ?? 'default';
    this.checkNamespace(targetNamespace);

    let pod: Pod | null = null;
    try {
      pod = await this.getPodStatus(targetNamespace, podName);
    } catch {
      return {
        source: 'kubernetes',
        logs: [],
        metadata: { error: `Pod "${podName}" not found in namespace "${targetNamespace}"` },
      };
    }

    const [events, logs, deployments] = await Promise.all([
      this.getEvents(targetNamespace, podName).catch(() => [] as Event[]),
      this.getPodLogs(targetNamespace, podName, 50).catch(() => [] as string[]),
      this.getDeployments(targetNamespace).catch(() => [] as Deployment[]),
    ]);

    const allLogs: string[] = [
      `Pod: ${podName}`,
      `Namespace: ${targetNamespace}`,
      `Phase: ${pod.phase}`,
      `Status: ${pod.status}`,
      pod.nodeName ? `Node: ${pod.nodeName}` : '',
      ...pod.containers.map(
        (c) =>
          `Container "${c.name}": ready=${c.ready}, restarts=${c.restartCount}, state=${c.state}`,
      ),
      ...events.map((e) => `[${e.type}] ${e.reason}: ${e.message} (${e.count}x)`),
      ...logs.map((l) => `[log] ${l}`),
      deployments.length > 0
        ? `Deployments: ${deployments.map((d) => `${d.name} (${d.availableReplicas}/${d.replicas} available)`).join(', ')}`
        : '',
    ].filter(Boolean);

    return {
      source: 'kubernetes',
      logs: allLogs.map((log) => redactSecrets(log)),
      metadata: {
        namespace: targetNamespace,
        podName,
        phase: pod.phase,
        status: pod.status,
        containerStatuses: pod.containers.map((c) => ({
          name: c.name,
          ready: c.ready,
          restartCount: c.restartCount,
          state: c.state,
        })),
        podEvents: events.length,
        deployments: deployments.length,
      },
    };
  }

  async getPodStatus(namespace: string, podName: string): Promise<Pod> {
    this.checkNamespace(namespace);
    const data = await this.request<{
      metadata: { name: string; namespace: string; creationTimestamp: string };
      status: {
        phase: string;
        conditions?: Array<{ type: string; status: string }>;
        containerStatuses?: Array<{
          name: string;
          ready: boolean;
          restartCount: number;
          state: Record<string, Record<string, unknown>>;
          started?: boolean;
        }>;
        hostIP?: string;
        podIP?: string;
      };
      spec?: { nodeName?: string };
    }>(`/api/v1/namespaces/${namespace}/pods/${podName}`);

    const statusCondition =
      data.status.conditions?.find((c) => c.type === 'Ready')?.status ?? 'Unknown';

    return {
      name: data.metadata.name,
      namespace: data.metadata.namespace,
      phase: data.status.phase as PodPhase,
      status: statusCondition as PodStatus,
      containers: (data.status.containerStatuses ?? []).map((cs) => {
        const stateKey = Object.keys(cs.state)[0] ?? 'unknown';
        return {
          name: cs.name,
          ready: cs.ready,
          restartCount: cs.restartCount,
          state: `${stateKey}: ${JSON.stringify(cs.state[stateKey])}`,
          started: cs.started,
        };
      }),
      nodeName: data.spec?.nodeName ?? data.status.hostIP,
      podIP: data.status.podIP,
      createdAt: data.metadata.creationTimestamp,
    };
  }

  async getPods(namespace: string): Promise<Pod[]> {
    this.checkNamespace(namespace);
    const data = await this.request<{
      items: Array<{
        metadata: { name: string; namespace: string; creationTimestamp: string };
        status: {
          phase: string;
          conditions?: Array<{ type: string; status: string }>;
          containerStatuses?: Array<{
            name: string;
            ready: boolean;
            restartCount: number;
            state: Record<string, Record<string, unknown>>;
            started?: boolean;
          }>;
          hostIP?: string;
          podIP?: string;
        };
        spec?: { nodeName?: string };
      }>;
    }>(`/api/v1/namespaces/${namespace}/pods`);

    return data.items.map((item) => {
      const statusCondition =
        item.status.conditions?.find((c) => c.type === 'Ready')?.status ?? 'Unknown';

      return {
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        phase: item.status.phase as PodPhase,
        status: statusCondition as PodStatus,
        containers: (item.status.containerStatuses ?? []).map((cs) => {
          const stateKey = Object.keys(cs.state)[0] ?? 'unknown';
          return {
            name: cs.name,
            ready: cs.ready,
            restartCount: cs.restartCount,
            state: `${stateKey}: ${JSON.stringify(cs.state[stateKey])}`,
            started: cs.started,
          };
        }),
        nodeName: item.spec?.nodeName ?? item.status.hostIP,
        podIP: item.status.podIP,
        createdAt: item.metadata.creationTimestamp,
      };
    });
  }

  async getEvents(namespace: string, podName?: string): Promise<Event[]> {
    this.checkNamespace(namespace);
    const fieldSelector = podName ? `?fieldSelector=involvedObject.name=${podName}` : '';
    const data = await this.request<{
      items: Array<{
        type: string;
        reason: string;
        message: string;
        source: { component: string };
        firstTimestamp: string;
        lastTimestamp: string;
        count: number;
        involvedObject: { name: string };
      }>;
    }>(`/api/v1/namespaces/${namespace}/events${fieldSelector}`);

    return data.items.map((item) => ({
      type: item.type as 'Normal' | 'Warning',
      reason: item.reason,
      message: item.message,
      source: item.source.component,
      firstTimestamp: item.firstTimestamp,
      lastTimestamp: item.lastTimestamp,
      count: item.count,
      involvedObject: item.involvedObject.name,
    }));
  }

  async getPodLogs(namespace: string, podName: string, tailLines = 50): Promise<string[]> {
    this.checkNamespace(namespace);
    const response = await fetch(
      `${this.apiServerUrl}/api/v1/namespaces/${namespace}/pods/${podName}/log?tailLines=${tailLines}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'User-Agent': 'aapsd-diagnosis',
        },
        dispatcher: this.dispatcher,
      } as any,
    );

    if (!response.ok) {
      throw new K8sApiError(
        response.status,
        `K8s API error: ${response.status} for logs of pod ${podName}`,
      );
    }

    const text = await response.text();
    return text.split('\n').filter(Boolean);
  }

  async getDeployments(namespace: string): Promise<Deployment[]> {
    this.checkNamespace(namespace);
    const data = await this.request<{
      items: Array<{
        metadata: { name: string; namespace: string; creationTimestamp: string };
        spec: {
          replicas: number;
          strategy: { type: string };
        };
        status: {
          availableReplicas?: number;
          readyReplicas?: number;
          updatedReplicas?: number;
          conditions?: Array<{ type: string; status: string }>;
        };
      }>;
    }>(`/apis/apps/v1/namespaces/${namespace}/deployments`);

    return data.items.map((item) => ({
      name: item.metadata.name,
      namespace: item.metadata.namespace,
      replicas: item.spec.replicas,
      availableReplicas: item.status.availableReplicas ?? 0,
      readyReplicas: item.status.readyReplicas ?? 0,
      updatedReplicas: item.status.updatedReplicas ?? 0,
      strategy: item.spec.strategy.type,
      conditions: (item.status.conditions ?? []).map((c) => `${c.type}: ${c.status}`),
      createdAt: item.metadata.creationTimestamp,
    }));
  }
}
