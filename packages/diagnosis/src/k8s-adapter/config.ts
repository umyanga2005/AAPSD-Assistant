export interface K8sConfig {
  token?: string;
  apiServerUrl?: string;
  allowedNamespaces?: string[];
  caCert?: string;
}
