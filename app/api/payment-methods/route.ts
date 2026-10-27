import { NextRequest, NextResponse } from 'next/server';
import { readPersistentPaymentConfig } from '@/lib/db/paymentMethodsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const config = readPersistentPaymentConfig();
    const enabledMethods = config.methods.filter((m) => m.enabled);

    return NextResponse.json(
      {
        success: true,
        methods: config.methods,
        enabledMethods,
        security: config.security,
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to read payment methods.' },
      { status: 500 }
    );
  }
}
