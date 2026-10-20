import { NextRequest, NextResponse } from 'next/server';
import { readPersistentPaymentConfig } from '@/lib/db/paymentMethodsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isFresh = searchParams.has('fresh') || searchParams.has('t');

    const config = readPersistentPaymentConfig();
    const enabledMethods = config.methods.filter((m) => m.enabled);

    const headers: Record<string, string> = isFresh
      ? { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      : { 'Cache-Control': 'public, max-age=15, s-maxage=60, stale-while-revalidate=120' };

    return NextResponse.json(
      {
        success: true,
        methods: config.methods,
        enabledMethods,
        security: config.security,
      },
      { headers }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to read payment methods.' },
      { status: 500 }
    );
  }
}
