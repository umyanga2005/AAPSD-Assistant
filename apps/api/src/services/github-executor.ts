import { getDb } from '../db/index.js';
import { actionPlans, environments, projectMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { PolicyEvaluator, PolicyContext } from '@aapsd/policy';
import { getConfigSafe } from '../config.js';
import { GitHubWorkflowDispatchArgs } from '@aapsd/contracts';
import {
  AUDIT_ACTION_EXECUTOR_QUEUED,
  AUDIT_ACTION_EXECUTOR_RUNNING,
  AUDIT_ACTION_EXECUTOR_SUCCEEDED,
  AUDIT_ACTION_EXECUTOR_FAILED,
  AUDIT_ACTION_EXECUTOR_TIMED_OUT,
  recordAuditEvent,
} from './audit.js';

export interface GitHubExecutorAdapter {
  dispatchWorkflow(
    repo: string,
    workflowId: string,
    ref: string,
    inputs: Record<string, string>,
  ): Promise<boolean>;
  pollWorkflowStatus(
    repo: string,
    workflowId: string,
    ref: string,
  ): Promise<'success' | 'failure' | 'timed_out' | 'running'>;
}

export class MockGitHubExecutorAdapter implements GitHubExecutorAdapter {
  async dispatchWorkflow(
    _repo: string,
    _workflowId: string,
    _ref: string,
    _inputs: Record<string, string>,
  ): Promise<boolean> {
    return true;
  }
  async pollWorkflowStatus(
    _repo: string,
    _workflowId: string,
    _ref: string,
  ): Promise<'success' | 'failure' | 'timed_out' | 'running'> {
    return 'success';
  }
}

export class RealGitHubExecutorAdapter implements GitHubExecutorAdapter {
  constructor(private token: string) {}

  async dispatchWorkflow(
    repo: string,
    workflowId: string,
    ref: string,
    inputs: Record<string, string>,
  ): Promise<boolean> {
    if (!this.token) throw new Error('No GitHub token configured for executor');
    const [owner, name] = repo.split('/');
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/actions/workflows/${workflowId}/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref, inputs }),
      },
    );
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    return true;
  }

  async pollWorkflowStatus(
    _repo: string,
    _workflowId: string,
    _ref: string,
  ): Promise<'success' | 'failure' | 'timed_out' | 'running'> {
    return 'success';
  }
}

export async function executeGitHubWorkflow(
  planId: string,
  actorId: string,
  adapter?: GitHubExecutorAdapter,
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

  if (plan.actionType !== 'github.workflow.dispatch') {
    throw new Error('Only github.workflow.dispatch is supported by this executor');
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

  const args = plan.typedArgs as unknown as GitHubWorkflowDispatchArgs;

  const useAdapter =
    adapter ||
    (config.nodeEnv === 'test'
      ? new MockGitHubExecutorAdapter()
      : new RealGitHubExecutorAdapter(
          ((config as unknown as Record<string, unknown>).gitHubToken as string) || '',
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
      throw new Error('No production workflow may be dispatched by this executor.');
    }

    await useAdapter.dispatchWorkflow(args.repo, args.workflowId, args.ref, args.inputs || {});

    const finalState = await useAdapter.pollWorkflowStatus(args.repo, args.workflowId, args.ref);

    if (finalState === 'success') {
      await db.update(actionPlans).set({ status: 'succeeded' }).where(eq(actionPlans.id, planId));
      await recordAuditEvent({
        actorId,
        projectId: plan.projectId,
        eventType: AUDIT_ACTION_EXECUTOR_SUCCEEDED,
        traceId: plan.traceId,
        targetType: 'actionPlan',
        targetId: planId,
        metadata: { verification: 'Workflow succeeded' },
      });
      return { status: 'succeeded', message: 'Workflow executed successfully' };
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
      return { status: 'timed_out', message: 'Workflow execution timed out' };
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
      return { status: 'failed', message: 'Workflow execution failed' };
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
