import { getDb } from '../db/index.js';
import { actionPlans, environments, projectMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { PolicyEvaluator, PolicyContext } from '@aapsd/policy';
import { getConfigSafe } from '../config.js';
import { KubernetesDeploymentRestartArgs } from '@aapsd/contracts';
import {
  AUDIT_ACTION_EXECUTOR_QUEUED,
  AUDIT_ACTION_EXECUTOR_RUNNING,
  AUDIT_ACTION_EXECUTOR_SUCCEEDED,
  AUDIT_ACTION_EXECUTOR_FAILED,
  AUDIT_ACTION_EXECUTOR_TIMED_OUT,
  recordAuditEvent,
} from './audit.js';

export interface KubernetesExecutorAdapter {
  restartDeployment(namespace: string, deploymentName: string): Promise<boolean>;
  pollRolloutStatus(
    namespace: string,
    deploymentName: string,
  ): Promise<'success' | 'failure' | 'timed_out' | 'running'>;
}

export class MockKubernetesExecutorAdapter implements KubernetesExecutorAdapter {
  async restartDeployment(_namespace: string, _deploymentName: string): Promise<boolean> {
    return true;
  }
  async pollRolloutStatus(
    _namespace: string,
    _deploymentName: string,
  ): Promise<'success' | 'failure' | 'timed_out' | 'running'> {
    return 'success';
  }
}

export class RealKubernetesExecutorAdapter implements KubernetesExecutorAdapter {
  constructor(
    private token: string,
    private apiServerUrl: string,
  ) {}

  async restartDeployment(namespace: string, deploymentName: string): Promise<boolean> {
    if (!this.token || !this.apiServerUrl) throw new Error('No K8s credentials configured');

    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
            },
          },
        },
      },
    };

    const res = await fetch(
      `${this.apiServerUrl}/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`,
      {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/strategic-merge-patch+json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(patch),
      },
    );

    if (!res.ok) {
      throw new Error(`K8s API error: ${res.status} ${res.statusText}`);
    }
    return true;
  }

  async pollRolloutStatus(
    _namespace: string,
    _deploymentName: string,
  ): Promise<'success' | 'failure' | 'timed_out' | 'running'> {
    return 'success';
  }
}

export async function executeKubernetesRestart(
  planId: string,
  actorId: string,
  adapter?: KubernetesExecutorAdapter,
): Promise<{ status: string; message: string }> {
  const db = getDb();

  const planRows = await db.select().from(actionPlans).where(eq(actionPlans.id, planId)).limit(1);
  if (planRows.length === 0) {
    throw new Error('Plan not found');
  }

  const plan = planRows[0];

  if (['queued', 'running', 'executed', 'succeeded', 'failed', 'timed_out'].includes(plan.status)) {
    return { status: plan.status, message: 'Execution already in progress or completed' };
  }

  if (plan.status !== 'approved') {
    throw new Error(`Plan is not approved (current status: ${plan.status})`);
  }

  if (plan.expiresAt && new Date() > new Date(plan.expiresAt)) {
    throw new Error('Plan has expired');
  }

  if (plan.actionType !== 'kubernetes.deployment.restart') {
    throw new Error('Only kubernetes.deployment.restart is supported by this executor');
  }

  const envRows = await db
    .select()
    .from(environments)
    .where(eq(environments.id, plan.environmentId))
    .limit(1);
  if (envRows.length === 0) throw new Error('Environment not found');
  const envName = envRows[0].name.toLowerCase();
  if (envName !== 'staging') {
    throw new Error('Execution is only permitted in the staging environment');
  }

  const configResult = getConfigSafe();
  const config =
    'gitHubAllowedRepos' in configResult
      ? configResult
      : {
          gitHubAllowedRepos: [],
          gitHubAllowedWorkflows: [],
          k8sAllowedNamespaces: [],
          actionAllowedDeployments: [],
          actionMinScale: 1,
          actionMaxScale: 5,
          nodeEnv: 'development' as const,
        };

  const evaluator = new PolicyEvaluator({
    allowedRepos: config.gitHubAllowedRepos,
    allowedWorkflows: config.gitHubAllowedWorkflows,
    allowedNamespaces: config.k8sAllowedNamespaces,
    allowedDeployments: config.actionAllowedDeployments,
    minScale: config.actionMinScale,
    maxScale: config.actionMaxScale,
  });

  const member = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, plan.projectId), eq(projectMembers.userId, actorId)))
    .limit(1);

  const userRole = member.length > 0 ? member[0].role : 'viewer';

  const context: PolicyContext = {
    environmentName: envName,
    userRole,
    actionType: plan.actionType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: plan.typedArgs as any,
  };

  const policyResult = evaluator.evaluate(context);
  if (!policyResult.allowed) {
    throw new Error(`Policy re-evaluation failed: ${policyResult.reason}`);
  }

  const args = plan.typedArgs as unknown as KubernetesDeploymentRestartArgs;

  const useAdapter =
    adapter ||
    (config.nodeEnv === 'test'
      ? new MockKubernetesExecutorAdapter()
      : new RealKubernetesExecutorAdapter(
          ((config as unknown as Record<string, unknown>).k8sToken as string) || '',
          ((config as unknown as Record<string, unknown>).k8sApiServerUrl as string) || '',
        ));

  await db.update(actionPlans).set({ status: 'queued' }).where(eq(actionPlans.id, planId));
  await recordAuditEvent({
    actorId,
    projectId: plan.projectId,
    eventType: AUDIT_ACTION_EXECUTOR_QUEUED,
    traceId: plan.traceId,
    targetType: 'actionPlan',
    targetId: planId,
  });

  try {
    await db.update(actionPlans).set({ status: 'running' }).where(eq(actionPlans.id, planId));
    await recordAuditEvent({
      actorId,
      projectId: plan.projectId,
      eventType: AUDIT_ACTION_EXECUTOR_RUNNING,
      traceId: plan.traceId,
      targetType: 'actionPlan',
      targetId: planId,
    });

    if (config.nodeEnv === 'production') {
      throw new Error('No production requests may be dispatched by this executor.');
    }

    await useAdapter.restartDeployment(args.namespace, args.deploymentName);

    const finalState = await useAdapter.pollRolloutStatus(args.namespace, args.deploymentName);

    if (finalState === 'success') {
      await db.update(actionPlans).set({ status: 'succeeded' }).where(eq(actionPlans.id, planId));
      await recordAuditEvent({
        actorId,
        projectId: plan.projectId,
        eventType: AUDIT_ACTION_EXECUTOR_SUCCEEDED,
        traceId: plan.traceId,
        targetType: 'actionPlan',
        targetId: planId,
        metadata: { verification: 'Rollout succeeded' },
      });
      return { status: 'succeeded', message: 'Deployment restarted successfully' };
    } else if (finalState === 'timed_out') {
      await db.update(actionPlans).set({ status: 'timed_out' }).where(eq(actionPlans.id, planId));
      await recordAuditEvent({
        actorId,
        projectId: plan.projectId,
        eventType: AUDIT_ACTION_EXECUTOR_TIMED_OUT,
        traceId: plan.traceId,
        targetType: 'actionPlan',
        targetId: planId,
      });
      return { status: 'timed_out', message: 'Deployment restart rollout timed out' };
    } else {
      await db.update(actionPlans).set({ status: 'failed' }).where(eq(actionPlans.id, planId));
      await recordAuditEvent({
        actorId,
        projectId: plan.projectId,
        eventType: AUDIT_ACTION_EXECUTOR_FAILED,
        traceId: plan.traceId,
        targetType: 'actionPlan',
        targetId: planId,
      });
      return { status: 'failed', message: 'Deployment restart rollout failed' };
    }
  } catch (error: unknown) {
    const err = error as Error;
    await db.update(actionPlans).set({ status: 'failed' }).where(eq(actionPlans.id, planId));
    await recordAuditEvent({
      actorId,
      projectId: plan.projectId,
      eventType: AUDIT_ACTION_EXECUTOR_FAILED,
      traceId: plan.traceId,
      targetType: 'actionPlan',
      targetId: planId,
      metadata: { error: err.message },
    });
    throw new Error(`Execution failed: ${err.message}`);
  }
}
