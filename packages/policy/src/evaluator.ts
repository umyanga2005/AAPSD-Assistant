import type {
  ActionType,
  ActionArgs,
  GitHubWorkflowDispatchArgs,
  KubernetesDeploymentRestartArgs,
  KubernetesDeploymentScaleArgs,
} from '@aapsd/contracts';

export interface PolicyContext {
  environmentName: string;
  userRole: string;
  actionType: string;
  args: ActionArgs;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

export interface PolicyConfig {
  allowedRepos: string[];
  allowedWorkflows: string[];
  allowedNamespaces: string[];
  allowedDeployments: string[];
  minScale: number;
  maxScale: number;
}

// Basic hierarchy map for validation
const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  developer: 2,
  approver: 3,
  devops_engineer: 4,
  administrator: 5,
};

export class PolicyEvaluator {
  constructor(private config: PolicyConfig) {}

  public evaluate(context: PolicyContext): PolicyResult {
    // 1. Enforce minimum role for planning (developer)
    const roleLevel = ROLE_HIERARCHY[context.userRole] || 0;
    if (roleLevel < ROLE_HIERARCHY['developer']) {
      return { allowed: false, reason: 'Insufficient role to plan actions' };
    }

    // 2. Reject production environments
    const env = context.environmentName.toLowerCase();
    if (env === 'prod' || env === 'production') {
      return { allowed: false, reason: 'Actions are not allowed in production environment' };
    }

    // 3. Evaluate specific action types
    switch (context.actionType as ActionType) {
      case 'github.workflow.dispatch':
        return this.evaluateGitHubWorkflowDispatch(context.args as GitHubWorkflowDispatchArgs);

      case 'kubernetes.deployment.restart':
        return this.evaluateK8sRestart(context.args as KubernetesDeploymentRestartArgs);

      case 'kubernetes.deployment.scale':
        return this.evaluateK8sScale(context.args as KubernetesDeploymentScaleArgs);

      default:
        return { allowed: false, reason: `Unknown action type: ${context.actionType}` };
    }
  }

  private evaluateGitHubWorkflowDispatch(args: GitHubWorkflowDispatchArgs): PolicyResult {
    if (!this.config.allowedRepos.includes(args.repo)) {
      return { allowed: false, reason: `Repository not in allowlist: ${args.repo}` };
    }
    if (!this.config.allowedWorkflows.includes(args.workflowId)) {
      return { allowed: false, reason: `Workflow not in allowlist: ${args.workflowId}` };
    }
    return { allowed: true };
  }

  private evaluateK8sRestart(args: KubernetesDeploymentRestartArgs): PolicyResult {
    if (!this.config.allowedNamespaces.includes(args.namespace)) {
      return { allowed: false, reason: `Namespace not in allowlist: ${args.namespace}` };
    }
    if (!this.config.allowedDeployments.includes(args.deploymentName)) {
      return { allowed: false, reason: `Deployment not in allowlist: ${args.deploymentName}` };
    }
    return { allowed: true };
  }

  private evaluateK8sScale(args: KubernetesDeploymentScaleArgs): PolicyResult {
    const baseCheck = this.evaluateK8sRestart({
      namespace: args.namespace,
      deploymentName: args.deploymentName,
    });
    if (!baseCheck.allowed) return baseCheck;

    if (args.replicas < this.config.minScale) {
      return {
        allowed: false,
        reason: `Scale replicas (${args.replicas}) below minimum (${this.config.minScale})`,
      };
    }
    if (args.replicas > this.config.maxScale) {
      return {
        allowed: false,
        reason: `Scale replicas (${args.replicas}) exceeds maximum (${this.config.maxScale})`,
      };
    }

    return { allowed: true };
  }
}
