import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MockPrometheusAdapter,
  RealPrometheusAdapter,
  PrometheusApiError,
  TimeoutError,
  setPrometheusAdapter,
  ALL_METRICS,
  METRIC_TEMPLATES,
  getTemplate,
} from '../src/prometheus-adapter/index.js';
import { collectPrometheusEvidence } from '../src/evidence-collector.js';

describe('getTemplate', () => {
  it('returns template for valid metric name', () => {
    const t = getTemplate('cpu');
    expect(t.name).toBe('cpu');
    expect(t.promql).toBeTruthy();
  });

  it('throws for unknown metric name', () => {
    expect(() => getTemplate('disk_io' as never)).toThrow('Unknown metric');
  });
});

describe('METRIC_TEMPLATES', () => {
  it('defines all five metric templates', () => {
    const names = METRIC_TEMPLATES.map((t) => t.name);
    expect(names).toEqual(['cpu', 'memory', 'restarts', 'error_rate', 'latency']);
  });

  it('every template has a promql and description', () => {
    for (const t of METRIC_TEMPLATES) {
      expect(t.promql).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });
});

describe('MockPrometheusAdapter', () => {
  const adapter = new MockPrometheusAdapter();

  it('returns mock evidence with all metrics', async () => {
    const evidence = await adapter.collectEvidence({
      start: '2026-07-13T10:00:00Z',
      end: '2026-07-13T11:00:00Z',
    });
    expect(evidence.source).toBe('prometheus');
    expect(evidence.logs.length).toBeGreaterThan(0);
    expect(evidence.metadata.metrics).toHaveLength(5);
  });

  it('returns empty evidence when timeRange is omitted', async () => {
    const evidence = await adapter.collectEvidence();
    expect(evidence.source).toBe('prometheus');
    expect(evidence.metadata.metrics).toHaveLength(5);
    expect(evidence.metadata.timeRange).toBeNull();
  });

  it('returns five time series data points per metric', async () => {
    const results = await adapter.queryAll();
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.timestamps).toHaveLength(5);
      expect(r.values).toHaveLength(5);
    }
  });

  it('returns metric results with correct shape', async () => {
    const result = await adapter.query('cpu');
    expect(result.queryName).toBe('cpu');
    expect(result.timestamps.length).toBeGreaterThan(0);
    expect(result.values.length).toBe(result.timestamps.length);
    expect(typeof result.values[0]).toBe('number');
    expect(result.description).toBeTruthy();
  });

  it('logs include metric name and last value', async () => {
    const evidence = await adapter.collectEvidence();
    const firstLog = evidence.logs[0];
    expect(firstLog).toMatch(/^\[cpu\]/);
    expect(firstLog).toMatch(/\(at 2026/);
  });

  it('metadata contains lastValue and lastTimestamp for each metric', async () => {
    const evidence = await adapter.collectEvidence();
    for (const m of evidence.metadata.metrics as Array<{
      name: string;
      lastValue: number;
      lastTimestamp: string;
    }>) {
      expect(typeof m.lastValue).toBe('number');
      expect(typeof m.lastTimestamp).toBe('string');
    }
  });

  it('query rejects unknown metric name', async () => {
    await expect(adapter.query('disk_io' as never)).rejects.toThrow('Unknown metric');
  });
});

describe('RealPrometheusAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws when baseUrl is missing', () => {
    expect(() => new RealPrometheusAdapter({ baseUrl: '' })).toThrow(
      'PROMETHEUS_BASE_URL is required',
    );
  });

  it('rejects disallowed metric names', async () => {
    const adapter = new RealPrometheusAdapter({
      baseUrl: 'http://prometheus:9090',
      allowedMetrics: ['cpu', 'memory'],
    });
    await expect(adapter.query('restarts')).rejects.toThrowError(PrometheusApiError);
    await expect(adapter.query('restarts')).rejects.toThrow(/not in the allowed list/);
  });

  it('returns evidence with only allowed metrics', async () => {
    const adapter = new RealPrometheusAdapter({
      baseUrl: 'http://prometheus:9090',
      allowedMetrics: ['cpu', 'memory'],
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            result: [
              {
                values: [
                  [1720800000, '0.25'],
                  [1720800060, '0.30'],
                ],
              },
            ],
          },
        }),
    });
    const evidence = await adapter.collectEvidence();
    const metrics = evidence.metadata.metrics as Array<{ name: string }>;
    const names = metrics.map((m) => m.name);
    expect(names).toContain('cpu');
    expect(names).toContain('memory');
    expect(names).not.toContain('restarts');
  });

  it('fetches metric data from Prometheus API', async () => {
    const mockResponse = {
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: {},
            values: [
              [1720800000, '0.15'],
              [1720800060, '0.18'],
            ],
          },
        ],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const adapter = new RealPrometheusAdapter({
      baseUrl: 'http://prometheus:9090',
      allowedMetrics: ALL_METRICS,
    });
    const result = await adapter.query('cpu', {
      start: '2026-07-13T10:00:00Z',
      end: '2026-07-13T11:00:00Z',
    });
    expect(result.queryName).toBe('cpu');
    expect(result.values).toEqual([0.15, 0.18]);
    expect(result.timestamps).toHaveLength(2);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/query_range'),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('throws PrometheusApiError on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const adapter = new RealPrometheusAdapter({
      baseUrl: 'http://prometheus:9090',
      allowedMetrics: ALL_METRICS,
    });
    await expect(adapter.query('cpu')).rejects.toThrowError(PrometheusApiError);
    await expect(adapter.query('cpu')).rejects.toThrow('Prometheus API error: 503');
  });

  it('throws TimeoutError when request is aborted', async () => {
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          const controller = new AbortController();
          controller.abort();
          reject(new DOMException('The operation was aborted', 'AbortError'));
        }),
    );

    const adapter = new RealPrometheusAdapter({
      baseUrl: 'http://prometheus:9090',
      allowedMetrics: ALL_METRICS,
    });
    await expect(adapter.query('cpu')).rejects.toThrowError(TimeoutError);
    await expect(adapter.query('cpu')).rejects.toThrow(/timed out/);
  });

  it('handles empty result set gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'success', data: { result: [] } }),
    });

    const adapter = new RealPrometheusAdapter({
      baseUrl: 'http://prometheus:9090',
      allowedMetrics: ALL_METRICS,
    });
    const result = await adapter.query('cpu');
    expect(result.values).toHaveLength(0);
    expect(result.timestamps).toHaveLength(0);
  });
});

describe('evidence-collector integration', () => {
  it('uses the configured adapter when available', async () => {
    setPrometheusAdapter(new MockPrometheusAdapter());
    const evidence = await collectPrometheusEvidence({
      start: '2026-07-13T10:00:00Z',
      end: '2026-07-13T11:00:00Z',
    });
    expect(evidence.source).toBe('prometheus');
    expect(evidence.logs.length).toBeGreaterThan(0);
    expect(evidence.metadata.metrics).toHaveLength(5);
  });

  it('falls back to stub when no adapter is set', async () => {
    setPrometheusAdapter(null as unknown as MockPrometheusAdapter);
    const evidence = await collectPrometheusEvidence();
    expect(evidence.source).toBe('prometheus');
    expect(evidence.logs[0]).toContain('[stub]');
  });

  it('returns metrics even without timeRange', async () => {
    setPrometheusAdapter(new MockPrometheusAdapter());
    const evidence = await collectPrometheusEvidence();
    expect(evidence.metadata.metrics).toHaveLength(5);
    expect(evidence.metadata.timeRange).toBeNull();
  });
});
