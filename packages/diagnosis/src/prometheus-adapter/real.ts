import type { CollectedEvidence } from '@aapsd/contracts';
import type { PrometheusAdapter, MetricName, MetricResult } from './types.js';
import { ALL_METRICS, METRIC_TEMPLATES, getTemplate } from './types.js';
import type { PrometheusConfig } from './config.js';
import { redactSecrets } from '../redactor.js';

export class PrometheusApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PrometheusApiError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class RealPrometheusAdapter implements PrometheusAdapter {
  private baseUrl: string;
  private allowedMetrics: Set<string>;

  constructor(config: PrometheusConfig) {
    if (!config.baseUrl) {
      throw new Error('PROMETHEUS_BASE_URL is required for RealPrometheusAdapter');
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.allowedMetrics = new Set(config.allowedMetrics ?? ALL_METRICS);
  }

  private checkMetric(name: MetricName): void {
    if (!this.allowedMetrics.has(name)) {
      throw new PrometheusApiError(
        403,
        `Metric "${name}" is not in the allowed list. Allowed: ${ALL_METRICS.join(', ')}`,
      );
    }
  }

  private async queryPromql(
    promql: string,
    timeRange?: { start: string; end: string },
    timeoutMs = 30_000,
  ): Promise<MetricResult> {
    const end = timeRange?.end ?? new Date().toISOString();
    const start = timeRange?.start ?? new Date(Date.now() - 3600_000).toISOString();
    const params = new URLSearchParams({ query: promql, start, end, step: '60' });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/query_range?${params}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'aapsd-diagnosis' },
      });

      if (!response.ok) {
        throw new PrometheusApiError(response.status, `Prometheus API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        data?: {
          result?: Array<{
            values?: Array<[number, string]>;
          }>;
        };
      };

      const result = data?.data?.result?.[0];
      const timestamps: string[] = [];
      const values: number[] = [];

      if (result?.values) {
        for (const [ts, val] of result.values) {
          timestamps.push(new Date(ts * 1000).toISOString());
          values.push(parseFloat(val));
        }
      }

      return { queryName: promql, timestamps, values, description: promql };
    } catch (err: unknown) {
      if (err instanceof PrometheusApiError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new TimeoutError(`Prometheus query timed out after ${timeoutMs}ms`);
      }
      throw new PrometheusApiError(0, (err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }

  async collectEvidence(timeRange?: { start: string; end: string }): Promise<CollectedEvidence> {
    const results: MetricResult[] = [];
    for (const template of METRIC_TEMPLATES) {
      if (this.allowedMetrics.has(template.name)) {
        try {
          results.push(await this.query(template.name, timeRange));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({
            queryName: template.name,
            timestamps: [],
            values: [],
            description: `Error: ${message}`,
          });
        }
      }
    }

    const logs = results.map((r) => {
      if (r.values.length === 0) {
        return `[${r.queryName}] ${r.description}`;
      }
      const lastIdx = r.values.length - 1;
      return `[${r.queryName}] ${r.description}: ${r.values[lastIdx]} (at ${r.timestamps[lastIdx]})`;
    });

    return {
      source: 'prometheus',
      logs: logs.map((log) => redactSecrets(log)),
      metadata: {
        metrics: results.map((r) => ({
          name: r.queryName,
          description: r.description,
          dataPoints: r.values.length,
          lastValue: r.values.length > 0 ? r.values[r.values.length - 1] : null,
          lastTimestamp: r.timestamps.length > 0 ? r.timestamps[r.timestamps.length - 1] : null,
        })),
        timeRange: timeRange ?? null,
      },
    };
  }

  async query(
    metricName: MetricName,
    timeRange?: { start: string; end: string },
  ): Promise<MetricResult> {
    this.checkMetric(metricName);
    const template = getTemplate(metricName);
    const result = await this.queryPromql(template.promql, timeRange);
    return { ...result, description: template.description, queryName: template.name };
  }

  async queryAll(timeRange?: { start: string; end: string }): Promise<MetricResult[]> {
    const results: MetricResult[] = [];
    for (const template of METRIC_TEMPLATES) {
      if (this.allowedMetrics.has(template.name)) {
        try {
          results.push(await this.query(template.name, timeRange));
        } catch {
          results.push({
            queryName: template.name,
            timestamps: [],
            values: [],
            description: template.description,
          });
        }
      }
    }
    return results;
  }
}
