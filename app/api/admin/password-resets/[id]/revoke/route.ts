import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/db/adminAuth';
import { revokeResetToken } from '@/lib/db/repositories/passwordReset';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing token ID' }, { status: 400 });
    }

    const success = await revokeResetToken(id);
    return NextResponse.json({ success, message: 'Password reset link has been revoked.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error revoking reset token';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
