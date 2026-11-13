/**
 * Cryptographic helper for legacy staff and customer password verification.
 * Modern password hashing uses scrypt via lib/security/password.ts.
 */

export function generateSalt(byteLength = 16): string {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  throw new Error('Secure random generator (crypto.getRandomValues) is required but unavailable.');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}:${salt}:alhamd_staff_v1`);

  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (cryptoObj && cryptoObj.subtle) {
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('Web Crypto subtle.digest is required for hashPassword.');
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  if (!password || !salt || !expectedHash) return false;
  const computed = await hashPassword(password, salt);
  if (computed === expectedHash) return true;

  if (password.trim() !== password) {
    const computedTrimmed = await hashPassword(password.trim(), salt);
    if (computedTrimmed === expectedHash) return true;
  }

  return false;
}

export async function hashCustomerPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}:${salt}:alhamd_customer_v1`);

  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (cryptoObj && cryptoObj.subtle) {
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('Web Crypto subtle.digest is required for hashCustomerPassword.');
}

export async function verifyCustomerPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  if (!password || !salt || !expectedHash) return false;
  const computed = await hashCustomerPassword(password, salt);
  if (computed === expectedHash) return true;

  if (password.trim() !== password) {
    const computedTrimmed = await hashCustomerPassword(password.trim(), salt);
    if (computedTrimmed === expectedHash) return true;
  }

  return false;
}
