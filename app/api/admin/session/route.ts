import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionAsync } from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSessionAsync(request);
    if (!session) {
      return NextResponse.json(
        { success: false, authenticated: false, error: 'Unauthorized: No active admin session.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        user: {
          id: session.id,
          name: session.name,
          email: session.email,
          role: session.role,
          isOwner: session.isOwner,
          permissions: session.permissions,
          status: session.status,
          expiresAt: session.expiresAt,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in GET /api/admin/session:', err);
    return NextResponse.json(
      { success: false, authenticated: false, error: 'Failed to retrieve admin session.' },
      { status: 500 }
    );
  }
}

