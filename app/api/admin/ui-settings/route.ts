import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionAsync, hasAdminPermission } from '@/lib/db/adminAuth';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';
import { checkRateLimit, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';
import { isDbConfigured } from '@/lib/db/mysql';
import {
  getHomepageAnimationsSettings,
  saveHomepageAnimationsSettings,
  getWhatsAppButtonSettings,
  saveWhatsAppButtonSettings,
  isSiteUiSettingsTableAvailable,
} from '@/lib/db/repositories/siteUiSettings';
import { normalizePakistaniMobileNumber } from '@/lib/db/siteUiSettings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSessionAsync(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required' },
        { status: 401 }
      );
    }

    const isAuthorized =
      Boolean(admin.isOwner) ||
      admin.role === 'SUPER_ADMIN' ||
      hasAdminPermission(admin, 'settings.appearance');

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Requires Owner, SUPER_ADMIN or settings.appearance permission.' },
        { status: 403 }
      );
    }

    const [animationsRes, whatsappRes, tableExists] = await Promise.all([
      getHomepageAnimationsSettings(),
      getWhatsAppButtonSettings(),
      isSiteUiSettingsTableAvailable(),
    ]);

    return NextResponse.json({
      success: true,
      tableExists,
      isDbConfigured: isDbConfigured(),
      animations: animationsRes.settings,
      whatsapp: whatsappRes.settings,
    });
  } catch (err: any) {
    console.error('Error fetching admin UI settings:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve UI settings.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
    }

    const admin = await getAdminSessionAsync(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required' },
        { status: 401 }
      );
    }

    const isAuthorized =
      Boolean(admin.isOwner) ||
      admin.role === 'SUPER_ADMIN' ||
      hasAdminPermission(admin, 'settings.appearance');

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Requires Owner, SUPER_ADMIN or settings.appearance permission.' },
        { status: 403 }
      );
    }

    const ip = getClientIp(request);
    const rateCheck = await checkRateLimit(`admin_ui_settings_${ip}`, 60, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds, 'Too many settings update requests.');
    }

    const body = await request.json().catch(() => null);
    const targetType = body?.type || (body?.key === 'homepage_animations' ? 'animations' : body?.key === 'whatsapp_button' ? 'whatsapp' : body?.key);
    const targetData = body?.data !== undefined ? body.data : body?.value;

    if (!body || !targetType) {
      return NextResponse.json(
        { success: false, error: 'Payload type ("animations" | "whatsapp") or key ("homepage_animations" | "whatsapp_button") is required.' },
        { status: 400 }
      );
    }

    if (targetType === 'animations') {
      const result = await saveHomepageAnimationsSettings(targetData, admin.email);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error, tableExists: result.tableExists },
          { status: result.tableExists === false ? 428 : 400 }
        );
      }
      return NextResponse.json({
        success: true,
        settings: targetData,
        tableExists: result.tableExists,
        message: 'Homepage animations updated successfully.',
      });
    }

    if (targetType === 'whatsapp') {
      // Validate Pakistani phone number if provided
      if (targetData?.phoneNumber) {
        const norm = normalizePakistaniMobileNumber(targetData.phoneNumber);
        if (!norm) {
          return NextResponse.json(
            { success: false, error: 'Invalid Pakistani mobile number. Must be a valid 12-digit number starting with 923 (e.g. 03432200995).' },
            { status: 400 }
          );
        }
        targetData.phoneNumber = norm;
      }

      const result = await saveWhatsAppButtonSettings(targetData, admin.email);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error, tableExists: result.tableExists },
          { status: result.tableExists === false ? 428 : 400 }
        );
      }
      return NextResponse.json({
        success: true,
        settings: targetData,
        tableExists: result.tableExists,
        message: 'WhatsApp button settings updated successfully.',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid setting type specified.' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Error saving admin UI settings:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update UI settings.' },
      { status: 500 }
    );
  }
}
