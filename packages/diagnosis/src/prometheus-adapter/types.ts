import type { CollectedEvidence } from '@aapsd/contracts';

export type MetricName = 'cpu' | 'memory' | 'restarts' | 'error_rate' | 'latency';

export const ALL_METRICS: MetricName[] = ['cpu', 'memory', 'restarts', 'error_rate', 'latency'];

export interface MetricTemplate {
  name: MetricName;
  promql: string;
  description: string;
}

export const METRIC_TEMPLATES: MetricTemplate[] = [
  {
    name: 'cpu',
    promql: 'rate(container_cpu_usage_seconds_total[5m])',
    description: 'Container CPU usage rate (cores)',
  },
  {
    name: 'memory',
    promql: 'container_memory_usage_bytes',
    description: 'Container memory usage (bytes)',
  },
  {
    name: 'restarts',
    promql: 'rate(kube_pod_container_status_restarts_total[5m])',
    description: 'Pod container restart rate',
  },
  {
    name: 'error_rate',
    promql: 'rate(http_requests_total{status=~"5.."}[5m])',
    description: 'HTTP 5xx error rate (requests/sec)',
  },
  {
    name: 'latency',
    promql: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))',
    description: 'P99 HTTP request latency (seconds)',
  },
];

export interface MetricResult {
  queryName: string;
  timestamps: string[];
  values: number[];
  description: string;
}

export function getTemplate(name: MetricName): MetricTemplate {
  const template = METRIC_TEMPLATES.find((t) => t.name === name);
  if (!template) {
    throw new Error(`Unknown metric: "${name}". Allowed: ${ALL_METRICS.join(', ')}`);
  }
  return template;
}

export interface PrometheusAdapter {
  collectEvidence(timeRange?: { start: string; end: string }): Promise<CollectedEvidence>;
  query(metricName: MetricName, timeRange?: { start: string; end: string }): Promise<MetricResult>;
  queryAll(timeRange?: { start: string; end: string }): Promise<MetricResult[]>;
}
