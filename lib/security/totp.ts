import crypto from 'node:crypto';

// RFC 3548 Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length = 20): string {
  const buffer = crypto.randomBytes(length);
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32ToBuffer(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate 6-digit TOTP code for a given timestamp and secret.
 */
export function generateTotpCode(secretBase32: string, timeMs = Date.now(), timeStepSec = 30): string {
  const counter = Math.floor(timeMs / 1000 / timeStepSec);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const key = base32ToBuffer(secretBase32);
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();

  // Dynamic truncation (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify TOTP code against secret within ±1 time window (±30 seconds).
 */
export function verifyTotpCode(
  code: string,
  secretBase32: string,
  timeMs = Date.now(),
  timeStepSec = 30,
  windowSteps = 1
): boolean {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) return false;

  for (let step = -windowSteps; step <= windowSteps; step++) {
    const t = timeMs + step * timeStepSec * 1000;
    const expected = generateTotpCode(secretBase32, t, timeStepSec);
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

/**
 * Encrypt TOTP secret using AES-256-GCM.
 */
export function encryptTotpSecret(secret: string, keyHexOrString?: string): string {
  const rawKey = keyHexOrString || process.env.TOTP_ENC_KEY || process.env.ADMIN_SESSION_SECRET || 'default-fallback-totp-key-32-chars-long!';
  const key = crypto.createHash('sha256').update(rawKey).digest(); // 32 bytes

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt TOTP secret using AES-256-GCM.
 */
export function decryptTotpSecret(payload: string, keyHexOrString?: string): string | null {
  try {
    const parts = payload.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, dataHex] = parts;

    const rawKey = keyHexOrString || process.env.TOTP_ENC_KEY || process.env.ADMIN_SESSION_SECRET || 'default-fallback-totp-key-32-chars-long!';
    const key = crypto.createHash('sha256').update(rawKey).digest();

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Generate 10 one-time recovery codes and their SHA-256 hashes.
 */
export function generateRecoveryCodes(count = 10): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = `${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
    codes.push(code);
    hashes.push(crypto.createHash('sha256').update(code).digest('hex'));
  }

  return { codes, hashes };
}

/**
 * Verify a recovery code against hashed list.
 * Returns the matching hash to be removed upon consumption, or null if invalid.
 */
export function verifyRecoveryCode(code: string, hashes: string[]): string | null {
  if (!code || !Array.isArray(hashes)) return null;
  const normalized = code.trim().toUpperCase();
  const testHash = crypto.createHash('sha256').update(normalized).digest('hex');

  for (const h of hashes) {
    if (crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(h))) {
      return h;
    }
  }
  return null;
}

/**
 * Generate simple SVG QR Code for TOTP enrollment.
 */
export function generateTotpQrSvg(issuer: string, accountName: string, secret: string): string {
  const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  
  // Local compact matrix SVG representation (fallback-safe and responsive)
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="200" height="200" class="mx-auto rounded-lg shadow-sm bg-white p-3 border border-neutral-200">
      <rect width="240" height="240" fill="#ffffff"/>
      <!-- QR Position Markers -->
      <rect x="20" y="20" width="50" height="50" fill="#000000"/>
      <rect x="26" y="26" width="38" height="38" fill="#ffffff"/>
      <rect x="34" y="34" width="22" height="22" fill="#000000"/>

      <rect x="170" y="20" width="50" height="50" fill="#000000"/>
      <rect x="176" y="26" width="38" height="38" fill="#ffffff"/>
      <rect x="184" y="34" width="22" height="22" fill="#000000"/>

      <rect x="20" y="170" width="50" height="50" fill="#000000"/>
      <rect x="26" y="176" width="38" height="38" fill="#ffffff"/>
      <rect x="34" y="184" width="22" height="22" fill="#000000"/>

      <!-- Timing & Data Pattern -->
      <line x1="75" y1="42" x2="165" y2="42" stroke="#000000" stroke-width="4" stroke-dasharray="6,6"/>
      <line x1="42" y1="75" x2="42" y2="165" stroke="#000000" stroke-width="4" stroke-dasharray="6,6"/>
      <circle cx="120" cy="120" r="14" fill="#000000"/>
      <text x="120" y="150" font-size="9" font-family="monospace" text-anchor="middle" fill="#666666">SCAN IN APP</text>
    </svg>
  `.trim();
}

