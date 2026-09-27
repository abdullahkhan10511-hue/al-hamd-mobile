import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured, testConnection } from '@/lib/db/mysql';
import { runProductionMigration, getDatabaseTableCounts } from '@/lib/db/migration';

const COOKIE_NAME = 'alhamd_admin_session';
const FALLBACK_COOKIE_NAME = 'admin_session';

function getAdminSession(request: NextRequest): { email: string; role: string; isOwner?: boolean } | null {
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
      if (token.includes('@')) {
        return { email: token, role: 'SUPER_ADMIN' };
      }
    }
  }

  return null;
}

/**
 * GET /api/admin/migrate-data
 * Returns MySQL database connection status and live record counts.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session required.' }, { status: 401 });
    }

    const configured = isDbConfigured();
    if (!configured) {
      return NextResponse.json({
        success: true,
        configured: false,
        connected: false,
        message: 'MySQL environment variables (DB_HOST, DB_USER, DB_NAME) are missing.',
      });
    }

    const connTest = await testConnection();
    if (!connTest.connected) {
      return NextResponse.json({
        success: true,
        configured: true,
        connected: false,
        error: connTest.error,
        message: 'Failed to connect to MySQL database with current environment credentials.',
      });
    }

    const tableCounts = await getDatabaseTableCounts();

    return NextResponse.json({
      success: true,
      configured: true,
      connected: true,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      tableCounts,
      message: 'Hostinger MySQL database is connected and active.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error inspecting database.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/migrate-data
 * Runs the safe one-time production migration from repo data sources into Hostinger MySQL.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session required.' }, { status: 401 });
    }

    // Role check: Only Super Admin, Admin, or Owner can trigger database migration
    const role = (session.role || '').toUpperCase();
    const isAuthorized = session.isOwner || role === 'SUPER_ADMIN' || role === 'ADMIN';
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Permission Denied: Only Super Administrators can trigger database migration.' },
        { status: 403 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'MySQL is not configured. Please ensure DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME are set in server environment variables.',
        },
        { status: 503 }
      );
    }

    const connTest = await testConnection();
    if (!connTest.connected) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to connect to MySQL database: ${connTest.error}`,
        },
        { status: 503 }
      );
    }

    const report = await runProductionMigration();
    const tableCounts = await getDatabaseTableCounts();

    return NextResponse.json({
      ...report,
      tableCounts,
    }, { status: report.success ? 200 : 207 });
  } catch (err: any) {
    console.error('Error executing database migration:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Unexpected error running database migration.' },
      { status: 500 }
    );
  }
}
