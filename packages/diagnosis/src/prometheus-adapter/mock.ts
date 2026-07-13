import type { CollectedEvidence } from '@aapsd/contracts';
import type { PrometheusAdapter, MetricName, MetricResult, MetricTemplate } from './types.js';
import { METRIC_TEMPLATES, getTemplate } from './types.js';
import { redactSecrets } from '../redactor.js';

function mockResult(template: MetricTemplate): MetricResult {
  const now = Date.now();
  const timestamps: string[] = [];
  const values: number[] = [];
  for (let i = 0; i < 5; i++) {
    timestamps.push(new Date(now - (4 - i) * 60_000).toISOString());
    switch (template.name) {
      case 'cpu':
        values.push(parseFloat((0.15 + Math.random() * 0.3).toFixed(4)));
        break;
      case 'memory':
        values.push(Math.floor(1.2e8 + Math.random() * 4e7));
        break;
      case 'restarts':
        values.push(parseFloat((Math.random() * 2).toFixed(2)));
        break;
      case 'error_rate':
        values.push(parseFloat((Math.random() * 5).toFixed(2)));
        break;
      case 'latency':
        values.push(parseFloat((0.05 + Math.random() * 0.5).toFixed(3)));
        break;
    }
  }
  return { queryName: template.name, timestamps, values, description: template.description };
}

export class MockPrometheusAdapter implements PrometheusAdapter {
  async collectEvidence(timeRange?: { start: string; end: string }): Promise<CollectedEvidence> {
    const results = await this.queryAll(timeRange);
    const logs = results.map((r) => {
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
          lastValue: r.values[r.values.length - 1],
          lastTimestamp: r.timestamps[r.timestamps.length - 1],
        })),
        timeRange: timeRange ?? null,
      },
    };
  }

  async query(
    metricName: MetricName,
    _timeRange?: { start: string; end: string },
  ): Promise<MetricResult> {
    const template = getTemplate(metricName);
    return mockResult(template);
  }

  async queryAll(_timeRange?: { start: string; end: string }): Promise<MetricResult[]> {
    return METRIC_TEMPLATES.map(mockResult);
  }
}
