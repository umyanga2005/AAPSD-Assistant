export interface ValidationError {
  field: string;
  message: string;
}

export interface DiagnoseBody {
  projectId: string;
  environmentId: string;
  query: string;
  context?: {
    pipelineRunId?: string;
    podName?: string;
    timeRange?: { start: string; end: string };
  };
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalTimeRange(value: unknown): value is { start: string; end: string } | undefined {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return isString(obj.start) && isString(obj.end);
}

export function validateDiagnoseBody(
  body: unknown,
): { valid: false; errors: ValidationError[] } | { valid: true; data: DiagnoseBody } {
  if (typeof body !== 'object' || body === null) {
    return {
      valid: false,
      errors: [{ field: 'body', message: 'Request body must be a JSON object' }],
    };
  }

  const input = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  if (!isString(input.projectId)) {
    errors.push({
      field: 'projectId',
      message: 'projectId is required and must be a non-empty string',
    });
  }

  if (!isString(input.environmentId)) {
    errors.push({
      field: 'environmentId',
      message: 'environmentId is required and must be a non-empty string',
    });
  }

  if (!isString(input.query)) {
    errors.push({ field: 'query', message: 'query is required and must be a non-empty string' });
  }

  if (input.context !== undefined) {
    if (typeof input.context !== 'object' || input.context === null) {
      errors.push({ field: 'context', message: 'context must be an object if provided' });
    } else {
      const ctx = input.context as Record<string, unknown>;
      if (!isOptionalString(ctx.pipelineRunId)) {
        errors.push({
          field: 'context.pipelineRunId',
          message: 'pipelineRunId must be a string if provided',
        });
      }
      if (!isOptionalString(ctx.podName)) {
        errors.push({ field: 'context.podName', message: 'podName must be a string if provided' });
      }
      if (!isOptionalTimeRange(ctx.timeRange)) {
        errors.push({
          field: 'context.timeRange',
          message: 'timeRange must be an object with start and end strings',
        });
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      projectId: input.projectId as string,
      environmentId: input.environmentId as string,
      query: input.query as string,
      context: input.context as DiagnoseBody['context'],
    },
  };
}
