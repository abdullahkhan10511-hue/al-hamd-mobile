import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured, testConnection } from '@/lib/db/mysql';
import { runProductionMigration, getDatabaseTableCounts } from '@/lib/db/migration';
import {
  getAdminSessionAsync,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/db/adminAuth';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';
import { checkRateLimit, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';
import { logActivity } from '@/lib/db/repositories/activity';

/**
 * Task S19: Production Safety Lock
 * In production (NODE_ENV === 'production'), this endpoint must return HTTP 404
 * unless ALLOW_DATA_MIGRATION=true is explicitly set in environment variables.
 */
function isMigrationEndpointAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return process.env.ALLOW_DATA_MIGRATION === 'true';
  }
  return true;
}

/**
 * GET /api/admin/migrate-data
 * Strictly protected internal endpoint for checking database status.
 * In production, returns 404 by default unless ALLOW_DATA_MIGRATION=true.
 * When enabled, strictly requires valid store owner session.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isMigrationEndpointAllowed()) {
      return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
    }

    const session = await getAdminSessionAsync(request);
    if (!session) {
      return unauthorizedResponse('Unauthorized: Staff session required.');
    }

    if (!session.isOwner) {
      return forbiddenResponse('Forbidden: Only the store owner can access data migration status.');
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
 * In production, returns 404 by default unless ALLOW_DATA_MIGRATION=true.
 * When enabled:
 * - Requires same-origin CSRF validation
 * - Strictly requires valid store owner session (401 unauthenticated, 403 non-owner)
 * - Rate limited to 3 attempts per hour per client IP
 * - Writes an audit record to the activity log upon execution
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Production Safety Gate: must return 404 unless ALLOW_DATA_MIGRATION=true
    if (!isMigrationEndpointAllowed()) {
      return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
    }

    // 2. CSRF same-origin enforcement for mutating action
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
    }

    // 3. Strict Store Owner authentication
    const session = await getAdminSessionAsync(request);
    if (!session) {
      return unauthorizedResponse('Unauthorized: Staff session required.');
    }

    if (!session.isOwner) {
      return forbiddenResponse('Forbidden: Only the store owner can execute data migration.');
    }

    // 4. Rate Limiting: maximum 3 migration executions per hour
    const clientIp = getClientIp(request);
    const rateCheck = await checkRateLimit(`admin_migrate_data_${clientIp}`, 3, 3600000);
    if (!rateCheck.allowed) {
      return createRateLimitResponse(
        rateCheck.retryAfterSeconds,
        'Too many data migration requests. Maximum 3 per hour.'
      );
    }

    // 5. Database connectivity checks
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

    // 6. Execute data migration
    const report = await runProductionMigration();
    const tableCounts = await getDatabaseTableCounts();

    // 7. Record entry into the audit activity log
    await logActivity({
      adminEmail: session.email,
      action: 'DATA_MIGRATION_EXECUTED',
      target: 'production_database_migration',
      details: JSON.stringify({
        summary: report.summary,
        tableCounts,
        stats: report.stats,
      }),
    }).catch((logErr) => {
      console.warn('Failed to record migration activity log:', logErr);
    });

    return NextResponse.json(
      {
        ...report,
        tableCounts,
      },
      { status: report.success ? 200 : 207 }
    );
  } catch (err: any) {
    console.error('Error executing database migration:', err);
    return NextResponse.json(
      { success: false, error: 'Unexpected error running database migration.' },
      { status: 500 }
    );
  }
}
