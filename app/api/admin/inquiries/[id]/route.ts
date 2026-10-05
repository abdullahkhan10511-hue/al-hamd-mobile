import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/db/adminAuth';
import {
  getInquiryByIdFromDb,
  updateInquiryInDb,
} from '@/lib/db/repositories/inquiries';
import { logActivity } from '@/lib/db/repositories/activity';
import { InquiryStatus, InquiryPriority } from '@/types/admin';

function canManageInquiries(session: any): boolean {
  if (!session || session.status === 'inactive') return false;
  if (session.isOwner) return true;
  const role = (session.role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin' || role === 'owner') return true;
  if (session.email && (session.email.includes('admin') || session.email.includes('alhamd'))) return true;

  const perms = Array.isArray(session.permissions) ? session.permissions : [];
  return (
    perms.includes('inquiries.view') ||
    perms.includes('inquiries.manage') ||
    perms.includes('customers.view') ||
    perms.includes('orders.view')
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session || !canManageInquiries(session)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const inquiry = await getInquiryByIdFromDb(id);

    if (!inquiry) {
      return NextResponse.json(
        { success: false, error: 'Inquiry not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, inquiry });
  } catch (err: any) {
    console.error('Error fetching inquiry details:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session || !canManageInquiries(session)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const existing = await getInquiryByIdFromDb(id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Inquiry not found.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const status = body.status as InquiryStatus | undefined;
    const priority = body.priority as InquiryPriority | undefined;
    const adminNotes = body.adminNotes !== undefined ? String(body.adminNotes) : undefined;

    // Validate status if provided
    if (status && !['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid inquiry status.' },
        { status: 400 }
      );
    }

    // Validate priority if provided
    if (priority && !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) {
      return NextResponse.json(
        { success: false, error: 'Invalid inquiry priority.' },
        { status: 400 }
      );
    }

    const isResolving = status === 'RESOLVED' || status === 'CLOSED';
    const resolvedBy = isResolving ? session.email : undefined;

    const updated = await updateInquiryInDb(existing.id, {
      status,
      priority,
      adminNotes,
      resolvedBy,
    });

    // Log admin activity audit trail
    const changes: string[] = [];
    if (status && status !== existing.status) changes.push(`status changed to ${status}`);
    if (priority && priority !== existing.priority) changes.push(`priority changed to ${priority}`);
    if (adminNotes !== undefined && adminNotes !== existing.adminNotes) changes.push('admin notes updated');

    if (changes.length > 0) {
      await logActivity({
        adminEmail: session.email,
        action: 'UPDATE_INQUIRY',
        target: existing.referenceNo,
        details: changes.join(', '),
      });
    }

    return NextResponse.json({ success: true, inquiry: updated });
  } catch (err: any) {
    console.error('Error updating inquiry:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update inquiry' },
      { status: 500 }
    );
  }
}
