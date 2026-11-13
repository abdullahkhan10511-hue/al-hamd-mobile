import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionAsync, unauthorizedResponse, forbiddenResponse } from '@/lib/db/adminAuth';
import { getServerStaffById } from '@/lib/db/staff-server';
import { updateStaffInDb } from '@/lib/db/repositories/staff';
import {
  generateBase32Secret,
  generateTotpQrSvg,
  generateRecoveryCodes,
  encryptTotpSecret,
  verifyTotpCode,
} from '@/lib/security/totp';
import { assertSameOrigin, createCsrfForbiddenResponse } from '@/lib/security/csrf';
import { logActivity } from '@/lib/db/repositories/activity';

// Temporary cache for pending setup secrets before user confirms first code
const pendingSetupSecrets = new Map<string, { secret: string; recoveryCodes: string[]; recoveryHashes: string[]; createdAt: number }>();

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSessionAsync(request);
    if (!session || !session.id) {
      return unauthorizedResponse();
    }

    const staffUser = await getServerStaffById(session.id);
    if (!staffUser) {
      return unauthorizedResponse();
    }

    // Generate fresh secret and recovery codes for enrollment
    const secret = generateBase32Secret(20);
    const { codes: recoveryCodes, hashes: recoveryHashes } = generateRecoveryCodes(10);
    const qrSvg = generateTotpQrSvg('AL-HAMD SHOP', staffUser.email, secret);

    pendingSetupSecrets.set(staffUser.id, {
      secret,
      recoveryCodes,
      recoveryHashes,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      enabled: Boolean(staffUser.totpEnabled),
      secret,
      qrSvg,
      recoveryCodes,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrfCheck = assertSameOrigin(request);
    if (!csrfCheck.ok) {
      return createCsrfForbiddenResponse(csrfCheck.reason);
    }

    const session = await getAdminSessionAsync(request);
    if (!session || !session.id) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { code, action } = body;

    const staffUser = await getServerStaffById(session.id);
    if (!staffUser) {
      return unauthorizedResponse();
    }

    // Action: Disable 2FA
    if (action === 'disable') {
      // Must be owner or self
      await updateStaffInDb(staffUser.id, {
        totpEnabled: false,
        totpSecretEnc: undefined,
        totpRecoveryHashes: [],
      });

      await logActivity({
        adminEmail: session.email,
        action: 'TOTP_DISABLED',
        target: staffUser.email,
        details: 'Two-factor authentication disabled',
      });

      return NextResponse.json({
        success: true,
        message: 'Two-factor authentication has been disabled.',
      });
    }

    // Action: Confirm and Enable 2FA with first code
    const pending = pendingSetupSecrets.get(staffUser.id);
    if (!pending || Date.now() - pending.createdAt > 15 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: 'Setup session expired. Please refresh and try again.' },
        { status: 400 }
      );
    }

    if (!code || !verifyTotpCode(code.trim(), pending.secret)) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code. Please check your authenticator app.' },
        { status: 400 }
      );
    }

    // Encrypt secret with AES-256-GCM
    const encryptedSecret = encryptTotpSecret(pending.secret);

    await updateStaffInDb(staffUser.id, {
      totpEnabled: true,
      totpSecretEnc: encryptedSecret,
      totpRecoveryHashes: pending.recoveryHashes,
      totpEnrolledAt: new Date().toISOString(),
    });

    pendingSetupSecrets.delete(staffUser.id);

    await logActivity({
      adminEmail: session.email,
      action: 'TOTP_ENABLED',
      target: staffUser.email,
      details: 'Two-factor authentication successfully enrolled and enabled',
    });

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication successfully enabled!',
      recoveryCodes: pending.recoveryCodes,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

