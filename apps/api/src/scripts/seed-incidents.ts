import { getDb } from '../db/index.js';
import { incidents } from '../db/schema.js';

async function seedIncidents() {
  const db = getDb();

  const mockIncidents = [
    {
      title: 'Database Connection Timeout',
      severity: 'critical' as const,
      status: 'resolved' as const,
      description:
        'Multiple microservices reporting connection timeouts when attempting to reach the primary database cluster. Failover was initiated automatically.',
      impactedComponent: 'Primary Database',
    },
    {
      title: 'High Latency in Payment Gateway API',
      severity: 'high' as const,
      status: 'investigating' as const,
      description:
        'P99 latency for payment processing has exceeded the 2000ms threshold. Upstream provider confirms an issue on their end. Awaiting their fix.',
      impactedComponent: 'Payment Service',
    },
    {
      title: 'Elevated CPU on Worker Nodes',
      severity: 'low' as const,
      status: 'active' as const,
      description:
        'Background job processing cluster is sustaining 85% CPU utilization. Auto-scaler has been triggered to provision 3 new instances.',
      impactedComponent: 'Background Workers',
    },
  ];

  console.log('Seeding incidents...');

  for (const incident of mockIncidents) {
    await db.insert(incidents).values(incident);
  }

  console.log('Incidents seeded successfully!');
  process.exit(0);
}

seedIncidents().catch((err) => {
  console.error('Failed to seed incidents:', err);
  process.exit(1);
});
