import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db/mysql';
import { getInventoryLogs, recordInventoryLog } from '@/lib/db/repositories/inventory';
import { getAdminSession } from '@/lib/db/adminAuth';
import { allowDevMockFallback } from '@/lib/env';

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '150', 10);

    if (isDbConfigured()) {
      const logs = await getInventoryLogs(limit);
      return NextResponse.json({ success: true, count: logs.length, logs });
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { getDevInventoryLogs } = await import('@/lib/db/serverDevStorage');
      const logs = getDevInventoryLogs(limit);
      return NextResponse.json({ success: true, count: logs.length, logs });
    } else {
      return NextResponse.json({ success: true, count: 0, logs: [] });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    let log: any = null;

    if (isDbConfigured()) {
      log = await recordInventoryLog({
        productId: body.productId,
        productName: body.productName,
        sku: body.sku || 'N/A',
        type: body.type,
        changeAmount: Number(body.changeAmount) || 0,
        previousStock: Number(body.previousStock) || 0,
        newStock: Number(body.newStock) || 0,
        reason: body.reason,
        adminEmail: session.email,
      });
    } else if (process.env.NODE_ENV !== 'production' && allowDevMockFallback()) {
      const { recordDevInventoryLog } = await import('@/lib/db/serverDevStorage');
      log = await recordDevInventoryLog({
        productId: body.productId,
        productName: body.productName,
        sku: body.sku || 'N/A',
        type: body.type,
        changeAmount: Number(body.changeAmount) || 0,
        previousStock: Number(body.previousStock) || 0,
        newStock: Number(body.newStock) || 0,
        reason: body.reason,
        adminEmail: session.email,
      });
    } else {
      log = {
        id: `inv-${Date.now()}`,
        ...body,
        adminEmail: session.email,
        timestamp: new Date().toISOString(),
      };
    }

    return NextResponse.json({ success: true, log }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to record inventory log' }, { status: 500 });
  }
}

