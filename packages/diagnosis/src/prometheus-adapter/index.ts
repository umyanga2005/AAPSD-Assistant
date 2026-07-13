import type { PrometheusAdapter } from './types.js';
export type { PrometheusAdapter, MetricName, MetricResult, MetricTemplate } from './types.js';
export { ALL_METRICS, METRIC_TEMPLATES, getTemplate } from './types.js';
export type { PrometheusConfig } from './config.js';
export { MockPrometheusAdapter } from './mock.js';
export { RealPrometheusAdapter, PrometheusApiError, TimeoutError } from './real.js';

let currentAdapter: PrometheusAdapter | null = null;

export function setPrometheusAdapter(adapter: PrometheusAdapter): void {
  currentAdapter = adapter;
}

export function getPrometheusAdapter(): PrometheusAdapter | null {
  return currentAdapter;
}
