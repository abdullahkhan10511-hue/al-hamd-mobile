import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured, testConnection } from '@/lib/db/mysql';
import { runProductionMigration, getDatabaseTableCounts } from '@/lib/db/migration';
import { getAdminSession } from '@/lib/db/adminAuth';

/**
 * GET /api/admin/migrate-data
 * Strictly protected internal endpoint for checking database status.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.role || '').toUpperCase();
    const isAuthorized = session.isOwner || role === 'SUPER_ADMIN';
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const configured = isDbConfigured();
    if (!configured) {
      return NextResponse.json({
        success: true,
        configured: false,
        connected: false,
      });
    }

    const connTest = await testConnection();
    if (!connTest.connected) {
      return NextResponse.json({
        success: true,
        configured: true,
        connected: false,
      });
    }

    const tableCounts = await getDatabaseTableCounts();

    return NextResponse.json({
      success: true,
      configured: true,
      connected: true,
      tableCounts,
    });
  } catch (err: any) {
    console.error('Error inspecting database status:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/migrate-data
 * Strictly protected internal endpoint for running production database migration.
 * Kept only for internal server-side maintenance and CLI deployment tasks.
 */
export async function POST(request: NextRequest) {
  try {
    // Critical Production Safety Lock: Data seeding/importing is permanently disabled in production
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
      return NextResponse.json(
        {
          success: false,
          error: 'Production Safety Lock: Data seeding/importing is permanently disabled in production. Hostinger MySQL is the sole source of truth for persistent business data.',
        },
        { status: 403 }
      );
    }

    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Role check: Only Super Admin or Owner can trigger internal database migration
    const role = (session.role || '').toUpperCase();
    const isAuthorized = session.isOwner || role === 'SUPER_ADMIN';
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database is not configured.',
        },
        { status: 503 }
      );
    }

    const connTest = await testConnection();
    if (!connTest.connected) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to connect to database.',
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
      { success: false, error: 'Unexpected error running database migration.' },
      { status: 500 }
    );
  }
}
