export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  corsOrigin: string;
  nodeEnv: 'development' | 'production' | 'test';
  gitHubToken?: string;
  gitHubAllowedRepos: string[];
  k8sToken?: string;
  k8sApiServerUrl?: string;
  k8sAllowedNamespaces: string[];
  prometheusBaseUrl?: string;
  prometheusAllowedMetrics: string[];
  actionAllowedDeployments: string[];
  actionMinScale: number;
  actionMaxScale: number;
}

export class ConfigError extends Error {
  constructor(errors: string[]) {
    const message = `Configuration errors:\n${errors.map((e) => `  - ${e}`).join('\n')}`;
    super(message);
    this.name = 'ConfigError';
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isFinite(value) && value > 0 && Number.isInteger(value);
}

function isNodeEnv(value: string): value is AppConfig['nodeEnv'] {
  return ['development', 'production', 'test'].includes(value);
}

export function getConfig(): AppConfig {
  const errors: string[] = [];

  const portRaw = process.env.PORT ?? '';
  const port = parseInt(portRaw, 10);
  if (portRaw && !isPositiveInteger(port)) {
    errors.push(`PORT must be a positive integer, got "${portRaw}"`);
  }

  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required but was not set');
  }

  const redisUrl = process.env.REDIS_URL ?? '';
  if (!redisUrl) {
    errors.push('REDIS_URL is required but was not set');
  }

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  const nodeEnvRaw = process.env.NODE_ENV ?? '';
  if (nodeEnvRaw && !isNodeEnv(nodeEnvRaw)) {
    errors.push(`NODE_ENV must be one of: development, production, test. Got "${nodeEnvRaw}"`);
  }

  const gitHubToken = process.env.GITHUB_TOKEN || undefined;
  const allowedReposRaw = process.env.GITHUB_ALLOWED_REPOS || '';
  const gitHubAllowedRepos = allowedReposRaw
    ? allowedReposRaw
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
    : [];

  const k8sToken = process.env.K8S_TOKEN || undefined;
  const k8sApiServerUrl = process.env.K8S_API_SERVER_URL || undefined;
  const allowedNamespacesRaw = process.env.K8S_ALLOWED_NAMESPACES || '';
  const k8sAllowedNamespaces = allowedNamespacesRaw
    ? allowedNamespacesRaw
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
    : [];

  const prometheusBaseUrl = process.env.PROMETHEUS_BASE_URL || undefined;
  const allowedMetricsRaw = process.env.PROMETHEUS_ALLOWED_METRICS || '';
  const prometheusAllowedMetrics = allowedMetricsRaw
    ? allowedMetricsRaw
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
    : [];

  const actionAllowedDeploymentsRaw = process.env.ACTION_ALLOWED_DEPLOYMENTS || '';
  const actionAllowedDeployments = actionAllowedDeploymentsRaw
    ? actionAllowedDeploymentsRaw
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
    : [];

  const actionMinScale = process.env.ACTION_MIN_SCALE
    ? parseInt(process.env.ACTION_MIN_SCALE, 10)
    : 1;
  const actionMaxScale = process.env.ACTION_MAX_SCALE
    ? parseInt(process.env.ACTION_MAX_SCALE, 10)
    : 5;

  if (errors.length > 0) {
    throw new ConfigError(errors);
  }

  return {
    port: portRaw ? port : 3000,
    databaseUrl,
    redisUrl,
    corsOrigin,
    nodeEnv: nodeEnvRaw ? (nodeEnvRaw as AppConfig['nodeEnv']) : 'development',
    gitHubToken,
    gitHubAllowedRepos,
    k8sToken,
    k8sApiServerUrl,
    k8sAllowedNamespaces,
    prometheusBaseUrl,
    prometheusAllowedMetrics,
    actionAllowedDeployments,
    actionMinScale,
    actionMaxScale,
  };
}

export function getConfigSafe(): AppConfig | { _errors: string[] } {
  try {
    return getConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      return { _errors: err.message.split('\n') };
    }
    throw err;
  }
}
