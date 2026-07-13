const MULTI_LINE_PATTERNS: RegExp[] = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
  /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
];

const LINE_PATTERNS: RegExp[] = [
  // GitHub classic PATs and OAuth tokens
  /gh[psou]_[A-Za-z0-9]{36,}/g,
  // GitHub fine-grained PATs
  /github_pat_[A-Za-z0-9_]{22,}/g,
  // AWS access / secret access keys
  /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
  // OpenAI / OpenRouter API keys
  /sk-[A-Za-z0-9-]{20,}/g,
  // OpenRouter-specific keys
  /sk-or-v1-[A-Za-z0-9]{32,}/g,
  // Slack tokens
  /xox[baprs]-[A-Za-z0-9]{10,}/g,
  // Bearer and Basic auth headers
  /(?:Bearer |Basic )[A-Za-z0-9+/=._-]{20,}/gi,
  // JWT tokens (three base64url segments)
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // Database connection strings with embedded credentials
  /\w+:\/\/[^@\s]+@\S+/g,
  // SSH public keys
  /ssh-(?:rsa|ed25519|dss|ecdsa)\s+[A-Za-z0-9+/=]{20,}/g,
  // Azure storage account keys
  /AccountKey=[A-Za-z0-9+/=]{40,}/g,
  // npm / registry auth tokens
  /_authToken=[A-Za-z0-9-]+/g,
  // Heroku API keys
  /[hH][eE][rR][oO][kK][uU]::[A-Za-z0-9-]+/g,
  // Inline key assignments with quotes
  /(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi,
  // Inline key assignments without quotes
  /(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
];

const REDACTED = '[REDACTED]';

function redactLine(line: string): string {
  for (const pattern of LINE_PATTERNS) {
    line = line.replace(pattern, REDACTED);
  }
  return line;
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = redactValue(val);
    }
    return result;
  }
  return value;
}

export function redactSecrets(input: string): string {
  let result = input;
  for (const pattern of MULTI_LINE_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }
  return result.split('\n').map(redactLine).join('\n');
}

export function redactEvidence(
  logs: string[],
  metadata: Record<string, unknown>,
): { logs: string[]; metadata: Record<string, unknown> } {
  return {
    logs: logs.map((log) => redactSecrets(log)),
    metadata: redactValue(structuredClone(metadata)) as Record<string, unknown>,
  };
}
