import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/db/adminAuth';
import { getAllResetRequests } from '@/lib/db/repositories/passwordReset';

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await getAllResetRequests();
    return NextResponse.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error fetching reset requests';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
