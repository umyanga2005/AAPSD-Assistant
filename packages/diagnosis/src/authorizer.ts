import type { AuthorizationResult, DiagnosisRequest } from '@aapsd/contracts';

const ALLOWED_READ_ONLY_ACTIONS = ['view', 'read', 'list', 'get', 'diagnose'];

export function authorizeRequest(
  request: DiagnosisRequest,
  userRoles: string[],
): AuthorizationResult {
  if (!request.userId || !request.projectId || !request.environmentId) {
    return {
      authorized: false,
      reason: 'Missing required request fields (userId, projectId, environmentId)',
    };
  }

  if (userRoles.length === 0) {
    return {
      authorized: false,
      reason: 'User has no assigned roles',
    };
  }

  const allowed = userRoles.some((role) =>
    ALLOWED_READ_ONLY_ACTIONS.some((action) => {
      if (
        role === 'viewer' ||
        role === 'developer' ||
        role === 'devops_engineer' ||
        role === 'approver' ||
        role === 'administrator'
      ) {
        if (action === 'diagnose') return true;
      }
      return false;
    }),
  );

  if (!allowed) {
    return {
      authorized: false,
      reason: `User roles [${userRoles.join(', ')}] are not authorized for diagnosis`,
    };
  }

  return { authorized: true };
}
