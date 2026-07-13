const MULTI_LINE_PATTERNS: RegExp[] = [
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC )?PRIVATE KEY-----/g,
];

const LINE_PATTERNS: RegExp[] = [
  /gh[psou]_[A-Za-z0-9]{36,}/g,
  /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
  /sk-[A-Za-z0-9-]{20,}/g,
  /xox[baprs]-[A-Za-z0-9]{10,}/g,
  /(?:Bearer |Basic )[A-Za-z0-9+/=._-]{20,}/gi,
  /(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi,
  /(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
];

const REDACTED = '[REDACTED]';

function redactLine(line: string): string {
  for (const pattern of LINE_PATTERNS) {
    line = line.replace(pattern, REDACTED);
  }
  return line;
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
    metadata: structuredClone(metadata),
  };
}
