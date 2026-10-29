import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, hasAdminPermission, forbiddenResponse } from '@/lib/db/adminAuth';
import {
  getAllInquiriesFromDb,
  getInquiriesStatsFromDb,
} from '@/lib/db/repositories/inquiries';
import { InquiryStatus, InquiryPriority, InquiryType } from '@/types/admin';

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required.' },
        { status: 401 }
      );
    }

    if (!hasAdminPermission(session, ['inquiries.view', 'inquiries.manage', 'customers.view', 'orders.view'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view customer inquiries.');
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = (searchParams.get('status') as InquiryStatus) || undefined;
    const priority = (searchParams.get('priority') as InquiryPriority) || undefined;
    const inquiryType = (searchParams.get('type') || searchParams.get('inquiryType')) as InquiryType || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const [{ inquiries, total }, stats] = await Promise.all([
      getAllInquiriesFromDb({
        search,
        status,
        priority,
        inquiryType,
        page,
        limit,
      }),
      getInquiriesStatsFromDb(),
    ]);

    return NextResponse.json({
      success: true,
      inquiries,
      total,
      page,
      limit,
      stats,
    });
  } catch (err: any) {
    console.error('Error fetching admin inquiries:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch inquiries' },
      { status: 500 }
    );
  }
}
