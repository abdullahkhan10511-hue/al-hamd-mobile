import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminSession, hasAdminPermission } from '@/lib/db/adminAuth';
import {
  readPersistentPaymentConfig,
  writePersistentPaymentConfig,
} from '@/lib/db/paymentMethodsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = getAdminSession(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin session required.' },
      { status: 401 }
    );
  }

  if (!hasAdminPermission(session, ['settings.view', 'settings.edit'])) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Insufficient permissions to view payment settings.' },
      { status: 403 }
    );
  }

  const config = readPersistentPaymentConfig();
  return NextResponse.json(
    { success: true, methods: config.methods, security: config.security },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const session = getAdminSession(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin session required.' },
      { status: 401 }
    );
  }

  if (!hasAdminPermission(session, ['settings.edit'])) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Insufficient permissions to modify payment configuration.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid payload.' },
        { status: 400 }
      );
    }

    writePersistentPaymentConfig({
      methods: Array.isArray(body.methods) ? body.methods : undefined,
      security: body.security && typeof body.security === 'object' ? body.security : undefined,
    });

    try {
      revalidatePath('/checkout');
      revalidatePath('/admin/payment-methods');
      revalidatePath('/api/payment-methods');
    } catch (revalErr) {
      console.warn('Payment methods revalidation note:', revalErr);
    }

    const saved = readPersistentPaymentConfig();
    return NextResponse.json({
      success: true,
      message: 'Payment configuration saved successfully.',
      methods: saved.methods,
      security: saved.security,
    });
  } catch (err: any) {
    console.error('Failed to save payment methods:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save payment configuration.' },
      { status: 500 }
    );
  }
}
