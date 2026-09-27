import { NextRequest } from 'next/server';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

export interface AdminSession {
  id?: string;
  name?: string;
  email: string;
  role: string;
  isOwner?: boolean;
  permissions?: string[];
  status?: string;
}

export function getAdminSession(request: NextRequest): AdminSession | null {
  const cookieVal =
    request.cookies.get(COOKIE_NAME)?.value ||
    request.cookies.get(FALLBACK_COOKIE_NAME)?.value;

  if (cookieVal) {
    let raw = cookieVal;
    for (let i = 0; i < 3; i++) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.email && parsed.status !== 'inactive') {
          return parsed;
        }
      } catch {
        try {
          raw = decodeURIComponent(raw);
        } catch {
          break;
        }
      }
    }
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const parsed = JSON.parse(decodeURIComponent(token));
      if (parsed && parsed.email) return parsed;
    } catch {
      try {
        const parsed = JSON.parse(token);
        if (parsed && parsed.email) return parsed;
      } catch {
        if (token.includes('@')) {
          return { email: token, role: 'ADMIN' };
        }
      }
    }
  }

  return null;
}
