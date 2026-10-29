import { NextRequest, NextResponse } from 'next/server';
import { deleteReviewInDb } from '@/lib/db/repositories/reviews';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getAdminSession,
  hasAdminPermission,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/db/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse();
    }

    if (
      !hasAdminPermission(session, [
        'content.edit',
        'content.manage',
        'products.delete',
        'products.edit',
        'products.manage',
      ])
    ) {
      return forbiddenResponse('Forbidden: Insufficient permissions to delete product reviews.');
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Review ID is required.' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: true, deleted: true });
    }

    const deleted = await deleteReviewInDb(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Review not found or already deleted.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: true, message: 'Review deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting review:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete review.' },
      { status: 500 }
    );
  }
}
