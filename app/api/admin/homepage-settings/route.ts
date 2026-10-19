import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminSession } from '@/lib/db/adminAuth';
import {
  readPersistentHomepageSettings,
  writePersistentHomepageSettings,
  getMergedHomepageSettings,
  PersistentHomepageSettings,
} from '@/lib/db/homepageSettingsStorage';

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

  const settings = getMergedHomepageSettings();
  return NextResponse.json(
    { success: true, settings },
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

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid payload.' },
        { status: 400 }
      );
    }

    const current = readPersistentHomepageSettings();

    if (body.sections !== undefined) {
      if (!Array.isArray(body.sections)) {
        return NextResponse.json(
          { success: false, error: 'Sections must be an array.' },
          { status: 400 }
        );
      }
      current.sections = body.sections;
    }

    if (body.hero !== undefined) {
      if (typeof body.hero !== 'object' || body.hero === null) {
        return NextResponse.json(
          { success: false, error: 'Hero config must be an object.' },
          { status: 400 }
        );
      }
      current.hero = { ...(current.hero || {}), ...body.hero };
    }

    if (body.flashSale !== undefined) {
      if (typeof body.flashSale !== 'object' || body.flashSale === null) {
        return NextResponse.json(
          { success: false, error: 'Flash sale config must be an object.' },
          { status: 400 }
        );
      }
      current.flashSale = { ...(current.flashSale || {}), ...body.flashSale };
    }

    if (body.trustBenefits !== undefined) {
      if (!Array.isArray(body.trustBenefits)) {
        return NextResponse.json(
          { success: false, error: 'Trust benefits must be an array.' },
          { status: 400 }
        );
      }
      current.trustBenefits = body.trustBenefits;
    }

    if (body.allProducts !== undefined) {
      if (typeof body.allProducts !== 'object' || body.allProducts === null) {
        return NextResponse.json(
          { success: false, error: 'All products config must be an object.' },
          { status: 400 }
        );
      }
      current.allProducts = { ...(current.allProducts || {}), ...body.allProducts };
    }

    writePersistentHomepageSettings(current);

    // Invalidate public page caches
    try {
      revalidatePath('/');
      revalidatePath('/admin/homepage');
      revalidatePath('/api/homepage-settings');
    } catch (e) {
      console.warn('Path revalidation note:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Homepage settings saved successfully.',
      settings: getMergedHomepageSettings(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save homepage settings.' },
      { status: 500 }
    );
  }
}
