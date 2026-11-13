import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession } from '@/lib/db/customerSession';
import { getServerCustomerById, sanitizeCustomer } from '@/lib/db/customers-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await getCustomerSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No active customer session.' },
        { status: 401 }
      );
    }

    const fullCustomer = await getServerCustomerById(session.id);
    if (!fullCustomer || fullCustomer.status === 'suspended' || (fullCustomer as any).status === 'inactive') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Account not found or suspended.' },
        { status: 401 }
      );
    }

    const safeProfile = sanitizeCustomer(fullCustomer);

    return NextResponse.json(
      { success: true, customer: safeProfile },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err: any) {
    console.error('Error fetching customer profile:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve customer profile.' },
      { status: 500 }
    );
  }
}

