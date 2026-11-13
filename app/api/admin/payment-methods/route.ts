import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/db/requireAdmin';
import {
  readPersistentPaymentConfig,
  writePersistentPaymentConfig,
  computeAllowedCustomerTypes,
} from '@/lib/db/paymentMethodsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request, ['settings.view', 'settings.edit']);
  if (!auth.ok) return auth.response;

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
  const auth = await requireAdmin(request, { permissions: ['settings.edit'], checkCsrf: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid payload.' },
        { status: 400 }
      );
    }

    const ALLOWED_TIERS = new Set(['RETAIL', 'WHOLESALE', 'SUPER_WHOLESALE']);

    if (Array.isArray(body.methods)) {
      for (const m of body.methods) {
        if (!m || typeof m !== 'object') {
          return NextResponse.json(
            { success: false, error: 'Invalid payment method payload.' },
            { status: 400 }
          );
        }

        // Validate allowedCustomerTypes if provided
        if (m.allowedCustomerTypes !== undefined) {
          if (!Array.isArray(m.allowedCustomerTypes) || m.allowedCustomerTypes.length === 0) {
            return NextResponse.json(
              { success: false, error: `Payment method "${m.name || m.id}" must be available for at least one customer tier.` },
              { status: 400 }
            );
          }
          for (const tier of m.allowedCustomerTypes) {
            if (!ALLOWED_TIERS.has(tier)) {
              return NextResponse.json(
                { success: false, error: `Invalid customer tier "${tier}". Allowed tiers: RETAIL, WHOLESALE, SUPER_WHOLESALE.` },
                { status: 400 }
              );
            }
          }
        }
      }
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
