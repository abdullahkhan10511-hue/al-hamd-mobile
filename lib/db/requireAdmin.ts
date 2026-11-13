import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminSessionAsync,
  hasAdminPermission,
  unauthorizedResponse,
  forbiddenResponse,
  verifyCsrfOrigin,
  AdminSession,
} from './adminAuth';

export interface RequireAdminOptions {
  permissions?: string | string[];
  requireOwner?: boolean;
  requireCsrf?: boolean;
  checkCsrf?: boolean;
}

export type RequireAdminResult =
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse };

export async function requireAdmin(
  request: NextRequest,
  permissionsOrOptions?: string | string[] | RequireAdminOptions,
  maybeOptions?: RequireAdminOptions
): Promise<RequireAdminResult> {
  let permissions: string | string[] | undefined;
  let options: RequireAdminOptions | undefined;

  if (
    permissionsOrOptions &&
    typeof permissionsOrOptions === 'object' &&
    !Array.isArray(permissionsOrOptions)
  ) {
    options = permissionsOrOptions;
    permissions = options.permissions;
  } else {
    permissions = permissionsOrOptions as string | string[] | undefined;
    options = maybeOptions;
  }

  const method = request.method.toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const checkCsrf = options?.checkCsrf ?? options?.requireCsrf ?? isMutating;

  if (checkCsrf && !verifyCsrfOrigin(request)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Forbidden: Invalid request origin.' },
        { status: 403 }
      ),
    };
  }

  const session = await getAdminSessionAsync(request);
  if (!session || !session.email || session.status === 'inactive') {
    return {
      ok: false,
      response: unauthorizedResponse('Unauthorized: Valid admin session required.'),
    };
  }

  const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const isOwner = Boolean(
    session.isOwner ||
    session.role === 'SUPER_ADMIN' ||
    session.role === 'OWNER' ||
    (envAdminEmail && session.email.toLowerCase() === envAdminEmail)
  );

  if (options?.requireOwner && !isOwner) {
    return {
      ok: false,
      response: forbiddenResponse('Forbidden: Super administrator or owner access required.'),
    };
  }

  if (isOwner) {
    return { ok: true, session };
  }

  if (permissions) {
    const permList = Array.isArray(permissions) ? permissions : [permissions];
    if (permList.length > 0 && !hasAdminPermission(session, permList)) {
      return {
        ok: false,
        response: forbiddenResponse(`Forbidden: Insufficient permissions (requires ${permList.join(' or ')}).`),
      };
    }
  }

  return { ok: true, session };
}

