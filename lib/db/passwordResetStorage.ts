import fs from 'fs';
import path from 'path';

export interface StoredPasswordResetToken {
  id: string;
  user_type: 'customer' | 'staff';
  user_id: string | null;
  email: string;
  token_hash: string;
  expires_at: string; // ISO date string
  is_used: boolean;
  used_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const TOKENS_FILE = path.join(DATA_DIR, 'password-reset-tokens.json');

let memoryTokens: StoredPasswordResetToken[] | null = null;

function ensureFile(): StoredPasswordResetToken[] {
  if (memoryTokens !== null) {
    return memoryTokens;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(TOKENS_FILE)) {
      const content = fs.readFileSync(TOKENS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        memoryTokens = parsed;
        return memoryTokens;
      }
    }
  } catch (err) {
    console.warn('[passwordResetStorage] Error loading tokens file:', err);
  }

  memoryTokens = [];
  return memoryTokens;
}

function persistFile(tokens: StoredPasswordResetToken[]): void {
  memoryTokens = tokens;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
  } catch (err) {
    console.warn('[passwordResetStorage] Error persisting tokens file:', err);
  }
}

export function getStoredResetTokens(): StoredPasswordResetToken[] {
  return [...ensureFile()];
}

export function saveStoredResetToken(token: StoredPasswordResetToken): void {
  const current = ensureFile();
  const existingIdx = current.findIndex((t) => t.id === token.id);
  if (existingIdx >= 0) {
    current[existingIdx] = token;
  } else {
    current.unshift(token);
  }
  // Keep only the most recent 500 records to prevent unbounded growth
  persistFile(current.slice(0, 500));
}

export function findStoredTokenByHash(tokenHash: string): StoredPasswordResetToken | null {
  const current = ensureFile();
  return current.find((t) => t.token_hash === tokenHash) || null;
}

export function findRecentRequestsByEmailOrIp(
  email: string,
  ip: string | null,
  windowMinutes: number = 15
): StoredPasswordResetToken[] {
  const current = ensureFile();
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const lowerEmail = email.toLowerCase().trim();

  return current.filter((t) => {
    if (t.created_at < cutoff) return false;
    if (t.email.toLowerCase().trim() === lowerEmail) return true;
    if (ip && t.ip_address === ip) return true;
    return false;
  });
}
