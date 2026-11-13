import 'server-only';
/**
 * Denylist of known default/weak seed password hashes.
 * If any account in the database or session payload has a passwordHash matching
 * any entry here, login is immediately rejected and a server-side warning is logged.
 */
export const KNOWN_WEAK_HASHES: ReadonlySet<string> = new Set([
  'ac9337e548d76d824371bb3ea6331659d4b171adaf9ee052f38f687f8f26ad8e',
  'c420262734ea8537651c3e53b3a0708468d33b1cb4a4a6c24c3efbb6032313b1',
  'e540ebe0a9c6ce8109025d4436d1867a15d8ec213af7a0fa9bd470d3aa64a2d6',
]);

export function isKnownWeakHash(hash: string | undefined | null): boolean {
  if (!hash || typeof hash !== 'string') return false;
  return KNOWN_WEAK_HASHES.has(hash.trim().toLowerCase());
}

