import type { CollectedEvidence } from '@aapsd/contracts';
import type { K8sAdapter, Pod, Event, Deployment } from './types.js';
import { redactSecrets } from '../redactor.js';

export class MockK8sAdapter implements K8sAdapter {
  async collectEvidence(podName?: string, _namespace?: string): Promise<CollectedEvidence> {
    if (!podName) {
      return { source: 'kubernetes', logs: [], metadata: { note: 'No podName provided' } };
    }

    const targetNamespace = _namespace ?? 'default';
    const pod = await this.getPodStatus(targetNamespace, podName);
    const events = await this.getEvents(targetNamespace, podName);
    const logs = await this.getPodLogs(targetNamespace, podName, 20);
    const deployments = await this.getDeployments(targetNamespace);

    const allLogs: string[] = [
      `Pod: ${podName}`,
      `Namespace: ${targetNamespace}`,
      `Phase: ${pod.phase}`,
      `Status: ${pod.status}`,
      pod.nodeName ? `Node: ${pod.nodeName}` : '',
      ...events.map((e) => `[${e.type}] ${e.reason}: ${e.message} (${e.count}x)`),
      ...logs.map((l) => `[log] ${l}`),
      `Deployments: ${deployments.map((d) => `${d.name} (${d.availableReplicas}/${d.replicas} available)`).join(', ')}`,
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

  async getPodStatus(_namespace: string, _podName: string): Promise<Pod> {
    return {
      name: _podName,
      namespace: _namespace,
      phase: 'Pending',
      status: 'False',
      containers: [
        {
          name: 'app',
          ready: false,
          restartCount: 0,
          state: 'Waiting: ImagePullBackOff',
        },
        {
          name: 'sidecar',
          ready: true,
          restartCount: 2,
          state: 'Running',
        },
      ],
      nodeName: 'worker-3',
      createdAt: '2026-07-13T09:30:00Z',
    };
  }

  async getEvents(_namespace: string, _podName?: string): Promise<Event[]> {
    return [
      {
        type: 'Warning',
        reason: 'FailedCreatePodSandBox',
        message: 'Failed to create pod sandbox: kubelet may be out of resources',
        source: 'kubelet',
        firstTimestamp: '2026-07-13T09:31:00Z',
        lastTimestamp: '2026-07-13T09:35:00Z',
        count: 12,
        involvedObject: _podName ?? 'unknown',
      },
      {
        type: 'Normal',
        reason: 'Pulled',
        message: 'Container image "nginx:1.25" already present on machine',
        source: 'kubelet',
        firstTimestamp: '2026-07-13T09:30:00Z',
        lastTimestamp: '2026-07-13T09:30:00Z',
        count: 1,
        involvedObject: _podName ?? 'unknown',
      },
      {
        type: 'Warning',
        reason: 'BackOff',
        message: `Back-off restarting failed container "${_podName ?? 'app'}"`,
        source: 'kubelet',
        firstTimestamp: '2026-07-13T09:32:00Z',
        lastTimestamp: '2026-07-13T09:36:00Z',
        count: 5,
        involvedObject: _podName ?? 'unknown',
      },
    ];
  }

  async getPodLogs(_namespace: string, _podName: string, _tailLines?: number): Promise<string[]> {
    return [
      '2026-07-13T09:30:01Z INFO  Starting application server...',
      '2026-07-13T09:30:02Z INFO  Connected to database',
      '2026-07-13T09:30:03Z ERROR Failed to connect to cache service: connection refused',
      '2026-07-13T09:30:04Z WARN  Retrying cache connection (attempt 1/5)',
      '2026-07-13T09:30:05Z ERROR Cache service still unavailable, entering degraded mode',
    ];
  }

  async getDeployments(_namespace: string): Promise<Deployment[]> {
    return [
      {
        name: 'app-frontend',
        namespace: _namespace,
        replicas: 3,
        availableReplicas: 2,
        readyReplicas: 2,
        updatedReplicas: 3,
        strategy: 'RollingUpdate',
        conditions: ['Available: True'],
        createdAt: '2026-06-01T00:00:00Z',
      },
    ];
  }
}
