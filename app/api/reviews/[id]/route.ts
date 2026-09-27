import { NextRequest, NextResponse } from 'next/server';
import { deleteReviewInDb } from '@/lib/db/repositories/reviews';
import { isDbConfigured } from '@/lib/db/mysql';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Review ID is required' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: true, deleted: true });
    }

    const deleted = await deleteReviewInDb(id);
    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Error deleting review:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete review' },
      { status: 500 }
    );
  }
}
