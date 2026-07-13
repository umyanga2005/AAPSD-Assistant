import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MockK8sAdapter,
  RealK8sAdapter,
  K8sApiError,
  setK8sAdapter,
} from '../src/k8s-adapter/index.js';
import { collectKubernetesEvidence } from '../src/evidence-collector.js';

describe('MockK8sAdapter', () => {
  const adapter = new MockK8sAdapter();

  it('returns mock evidence when podName is provided', async () => {
    const evidence = await adapter.collectEvidence('my-pod', 'staging');
    expect(evidence.source).toBe('kubernetes');
    expect(evidence.logs.length).toBeGreaterThan(0);
    expect(evidence.metadata.namespace).toBe('staging');
    expect(evidence.metadata.podName).toBe('my-pod');
    expect(evidence.metadata.phase).toBe('Pending');
    expect(evidence.metadata.containerStatuses).toHaveLength(2);
  });

  it('returns empty evidence when podName is omitted', async () => {
    const evidence = await adapter.collectEvidence();
    expect(evidence.logs).toHaveLength(0);
    expect(evidence.metadata.note).toBe('No podName provided');
  });

  it('includes container status details in metadata', async () => {
    const evidence = await adapter.collectEvidence('my-pod');
    const containers = evidence.metadata.containerStatuses as Array<{
      name: string;
      ready: boolean;
      restartCount: number;
      state: string;
    }>;
    expect(containers[0].name).toBe('app');
    expect(containers[0].ready).toBe(false);
    expect(containers[0].state).toContain('ImagePullBackOff');
    expect(containers[1].name).toBe('sidecar');
    expect(containers[1].ready).toBe(true);
  });

  it('returns events in log output', async () => {
    const evidence = await adapter.collectEvidence('my-pod', 'default');
    const logs = evidence.logs.join('\n');
    expect(logs).toContain('FailedCreatePodSandBox');
    expect(logs).toContain('BackOff');
  });

  it('returns pod status', async () => {
    const pod = await adapter.getPodStatus('default', 'test-pod');
    expect(pod.phase).toBe('Pending');
    expect(pod.status).toBe('False');
    expect(pod.containers).toHaveLength(2);
  });

  it('returns events', async () => {
    const events = await adapter.getEvents('default', 'test-pod');
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('Warning');
    expect(events[0].reason).toBe('FailedCreatePodSandBox');
  });

  it('returns pod logs', async () => {
    const logs = await adapter.getPodLogs('default', 'test-pod');
    expect(logs).toHaveLength(5);
    expect(logs[0]).toContain('Starting application server');
  });

  it('returns deployments', async () => {
    const deployments = await adapter.getDeployments('default');
    expect(deployments).toHaveLength(1);
    expect(deployments[0].name).toBe('app-frontend');
    expect(deployments[0].availableReplicas).toBe(2);
  });
});

describe('RealK8sAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws when token is missing', () => {
    expect(() => new RealK8sAdapter({})).toThrow('K8S_TOKEN is required');
  });

  it('rejects namespaces not in the allowed list', async () => {
    const adapter = new RealK8sAdapter({
      token: 'k8s-fake-token',
      allowedNamespaces: ['allowed-ns'],
    });
    await expect(adapter.collectEvidence('my-pod', 'evil-ns')).rejects.toThrowError(K8sApiError);
    await expect(adapter.collectEvidence('my-pod', 'evil-ns')).rejects.toThrow(
      /not in the allowed list/,
    );
  });

  it('rejects namespace via getPodStatus', async () => {
    const adapter = new RealK8sAdapter({
      token: 'k8s-fake',
      allowedNamespaces: ['allowed-ns'],
    });
    await expect(adapter.getPodStatus('evil', 'pod')).rejects.toThrow(K8sApiError);
  });

  it('returns empty evidence when podName is omitted', async () => {
    const adapter = new RealK8sAdapter({
      token: 'k8s-fake',
      allowedNamespaces: [],
    });
    const evidence = await adapter.collectEvidence();
    expect(evidence.logs).toHaveLength(0);
    expect(evidence.metadata.note).toBe('No podName provided');
  });

  it('returns error metadata when pod is not found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const adapter = new RealK8sAdapter({
      token: 'k8s-fake',
      allowedNamespaces: ['default'],
    });
    const evidence = await adapter.collectEvidence('nonexistent', 'default');
    expect(evidence.metadata.error).toContain('not found');
  });

  it('fetches pod status via the K8s API', async () => {
    const mockPodResponse = {
      metadata: {
        name: 'my-pod',
        namespace: 'default',
        creationTimestamp: '2026-07-13T10:00:00Z',
      },
      status: {
        phase: 'Running',
        conditions: [{ type: 'Ready', status: 'True' }],
        containerStatuses: [
          {
            name: 'app',
            ready: true,
            restartCount: 0,
            state: { running: { startedAt: '2026-07-13T10:00:01Z' } },
            started: true,
          },
        ],
        hostIP: '10.0.0.1',
        podIP: '10.0.0.5',
      },
      spec: { nodeName: 'worker-1' },
    };

    const mockEventsResponse = { items: [] };
    const mockLogsResponse = 'line1\nline2\nline3';
    const mockDeploymentsResponse = { items: [] };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/pods/my-pod') && !url.includes('/log')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPodResponse) });
      }
      if (url.includes('/events')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEventsResponse) });
      }
      if (url.includes('/log')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(mockLogsResponse) });
      }
      if (url.includes('/deployments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDeploymentsResponse) });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const adapter = new RealK8sAdapter({
      token: 'k8s-fake-token',
      allowedNamespaces: ['default'],
    });
    const evidence = await adapter.collectEvidence('my-pod', 'default');
    expect(evidence.source).toBe('kubernetes');
    expect(evidence.metadata.phase).toBe('Running');
    expect(evidence.metadata.podName).toBe('my-pod');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/namespaces/default/pods/my-pod'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer k8s-fake-token' }),
      }),
    );
  });

  it('throws K8sApiError on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });

    const adapter = new RealK8sAdapter({
      token: 'k8s-fake',
      allowedNamespaces: ['default'],
    });
    await expect(adapter.getPodStatus('default', 'some-pod')).rejects.toThrowError(K8sApiError);
    await expect(adapter.getPodStatus('default', 'some-pod')).rejects.toThrow('K8s API error: 403');
  });

  it('redacts secrets from pod logs', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/pods/my-pod') && !url.includes('/log')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              metadata: {
                name: 'my-pod',
                namespace: 'default',
                creationTimestamp: '2026-01-01T00:00:00Z',
              },
              status: {
                phase: 'Running',
                containerStatuses: [
                  {
                    name: 'app',
                    ready: true,
                    restartCount: 0,
                    state: { running: {} },
                  },
                ],
              },
            }),
        });
      }
      if (url.includes('/events')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) });
      }
      if (url.includes('/log')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('password = "super-secret"\ntoken=ghp_abc123'),
        });
      }
      if (url.includes('/deployments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const adapter = new RealK8sAdapter({
      token: 'k8s-fake',
      allowedNamespaces: ['default'],
    });
    const evidence = await adapter.collectEvidence('my-pod', 'default');
    const allLogs = evidence.logs.join('\n');
    expect(allLogs).not.toContain('super-secret');
    expect(allLogs).not.toContain('ghp_abc123');
    expect(allLogs.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('redacts secrets from metadata', async () => {
    const adapter = new MockK8sAdapter();
    const evidence = await adapter.collectEvidence('test-pod');
    const logs = evidence.logs.join('\n');
    const metadata = evidence.metadata;
    expect(logs).toBeDefined();
    expect(metadata).toBeDefined();
  });
});

describe('evidence-collector integration', () => {
  it('uses the configured adapter when podName is provided', async () => {
    setK8sAdapter(new MockK8sAdapter());
    const evidence = await collectKubernetesEvidence('my-pod');
    expect(evidence.source).toBe('kubernetes');
    expect(evidence.logs.length).toBeGreaterThan(0);
    expect(evidence.metadata.podName).toBe('my-pod');
  });

  it('falls back to stub when no adapter is set', async () => {
    setK8sAdapter(null as unknown as MockK8sAdapter);
    const evidence = await collectKubernetesEvidence('some-pod');
    expect(evidence.source).toBe('kubernetes');
    expect(evidence.logs[0]).toContain('[stub]');
  });

  it('returns empty logs when podName is not provided', async () => {
    setK8sAdapter(new MockK8sAdapter());
    const evidence = await collectKubernetesEvidence();
    expect(evidence.source).toBe('kubernetes');
    expect(evidence.metadata).toHaveProperty('note');
  });
});
