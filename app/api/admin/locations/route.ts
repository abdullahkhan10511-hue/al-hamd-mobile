import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminSessionAsync } from '@/lib/db/adminAuth';
import { ShopLocation } from '@/types/admin';
import { isValidGoogleMapsUrl } from '@/lib/db/locations';
import { readPersistentLocations, writePersistentLocations } from '@/lib/db/locationStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = await getAdminSessionAsync(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin session required.' },
      { status: 401 }
    );
  }

  const locations = readPersistentLocations().sort(
    (a, b) => (a.displayOrder || 1) - (b.displayOrder || 1)
  );

  return NextResponse.json(
    { success: true, locations },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSessionAsync(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action, id } = body;

    const currentLocations = readPersistentLocations();

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json(
          { success: false, error: 'Location ID is required for deletion.' },
          { status: 400 }
        );
      }
      const filtered = currentLocations.filter((l) => l.id !== id);
      writePersistentLocations(filtered);

      let revalidated = true;
      try {
        revalidatePath('/', 'layout');
        revalidatePath('/');
        revalidatePath('/contact');
        revalidatePath('/api/locations');
        revalidatePath('/admin/shop-location');
      } catch (revErr) {
        console.warn('Location delete revalidation notice:', revErr);
        revalidated = false;
      }

      return NextResponse.json({
        success: true,
        revalidated,
        message: revalidated ? 'Saved and live' : 'Shop location deleted, but storefront revalidation is pending.',
        locations: filtered,
      });
    }

    // Create or Update
    const shopName = (body.shopName || '').trim();
    if (!shopName) {
      return NextResponse.json(
        { success: false, error: 'Please enter a shop name.' },
        { status: 400 }
      );
    }

    const googleMapsUrl = (body.googleMapsUrl || '').trim();
    if (!googleMapsUrl || !isValidGoogleMapsUrl(googleMapsUrl)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid Google Maps location link.' },
        { status: 400 }
      );
    }

    const locationId = body.id || `loc-${Date.now()}`;
    const now = new Date().toISOString();
    const existing = currentLocations.find((l) => l.id === locationId);

    const record: ShopLocation = {
      id: locationId,
      shopName,
      googleMapsUrl,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder) : (existing?.displayOrder || currentLocations.length + 1),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    let updatedList: ShopLocation[];
    if (existing) {
      updatedList = currentLocations.map((l) => (l.id === locationId ? record : l));
    } else {
      updatedList = [...currentLocations, record];
    }

    writePersistentLocations(updatedList);

    let revalidated = true;
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/');
      revalidatePath('/contact');
      revalidatePath('/api/locations');
      revalidatePath('/admin/shop-location');
    } catch (revErr) {
      console.warn('Location save revalidation notice:', revErr);
      revalidated = false;
    }

    return NextResponse.json({
      success: true,
      revalidated,
      message: revalidated ? 'Saved and live' : 'Shop location saved, but storefront revalidation is pending.',
      data: record,
      location: record,
      locations: updatedList,
    });
  } catch (err: any) {
    console.error('Error saving shop location:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save shop location.' },
      { status: 500 }
    );
  }
}
