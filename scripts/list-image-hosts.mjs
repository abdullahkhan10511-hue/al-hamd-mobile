#!/usr/bin/env node

/**
 * AL-HAMD SHOP — Image Host Audit Script (Task S11)
 *
 * Scans all database mock files, store settings, product/category definitions,
 * and storefront components to identify all referenced image hostnames.
 * Ensures that zero unauthorized third-party image hosts are used without
 * explicit inclusion in next.config.ts / IMAGE_REMOTE_HOSTS.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.ico'
]);

function isImageUrl(urlStr, keyName = '') {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const clean = urlStr.trim().toLowerCase();

  if (clean.startsWith('data:image/')) return true;

  const imageKeys = ['image', 'images', 'thumbnail', 'coverimage', 'media', 'logo', 'avatar', 'favicon', 'icon', 'src', 'imgsrc'];
  if (keyName && imageKeys.includes(keyName.toLowerCase())) {
    return true;
  }

  try {
    const u = new URL(clean, 'http://localhost');
    const ext = path.extname(u.pathname).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) return true;
    if (u.pathname.includes('/uploads/') || u.pathname.includes('/placeholders/')) return true;
  } catch {}

  return false;
}

export function getApprovedHosts() {
  const allowed = new Set(['alhamdshop.com', 'www.alhamdshop.com']);

  if (process.env.NODE_ENV !== 'production') {
    allowed.add('localhost');
    allowed.add('127.0.0.1');
  }

  const appUrls = [process.env.NEXT_PUBLIC_APP_URL, process.env.APP_URL].filter(Boolean);
  for (const raw of appUrls) {
    try {
      const u = new URL(raw);
      if (u.hostname) {
        if (process.env.NODE_ENV === 'production' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
          // skip
        } else {
          allowed.add(u.hostname);
        }
      }
    } catch {}
  }

  const remoteHostsEnv = process.env.IMAGE_REMOTE_HOSTS || '';
  if (remoteHostsEnv.trim()) {
    remoteHostsEnv
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
      .forEach((h) => {
        try {
          const u = h.includes('://') ? new URL(h) : new URL(`https://${h}`);
          if (u.hostname) allowed.add(u.hostname);
        } catch {
          allowed.add(h);
        }
      });
  }

  return allowed;
}

export function auditImageHosts() {
  const approvedHosts = getApprovedHosts();
  const hostCounts = new Map(); // hostname -> count
  let localCount = 0;
  let totalCount = 0;
  const unapprovedHosts = new Set();
  const samplesByHost = new Map();

  function recordUrl(urlStr, sourceFile, keyName = '') {
    if (!isImageUrl(urlStr, keyName)) return;

    const trimmed = urlStr.trim();
    totalCount++;

    if (trimmed.startsWith('/') || trimmed.startsWith('data:image/')) {
      localCount++;
      return;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const u = new URL(trimmed);
        const hostname = u.hostname.toLowerCase();
        hostCounts.set(hostname, (hostCounts.get(hostname) || 0) + 1);

        if (!samplesByHost.has(hostname)) {
          samplesByHost.set(hostname, { sample: trimmed, source: sourceFile });
        }

        if (!approvedHosts.has(hostname)) {
          unapprovedHosts.add(hostname);
        }
      } catch {
        // invalid URL
      }
    }
  }

  // 1. Audit data files
  const dataDir = path.join(projectRoot, 'data');
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir);
    for (const file of files) {
      const fullPath = path.join(dataDir, file);
      if (file.endsWith('.json')) {
        try {
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          const traverse = (obj, parentKey = '') => {
            if (!obj) return;
            if (typeof obj === 'string') {
              recordUrl(obj, `data/${file}`, parentKey);
            } else if (Array.isArray(obj)) {
              obj.forEach((item) => traverse(item, parentKey));
            } else if (typeof obj === 'object') {
              for (const [key, val] of Object.entries(obj)) {
                traverse(val, key);
              }
            }
          };
          traverse(content);
        } catch {}
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        const txt = fs.readFileSync(fullPath, 'utf8');
        const urlMatches = txt.match(/https?:\/\/[^\s'",`)]+/g) || [];
        for (const u of urlMatches) {
          recordUrl(u, `data/${file}`);
        }
      }
    }
  }

  // 2. Audit codebase (components & app)
  const scanDirs = [path.join(projectRoot, 'components'), path.join(projectRoot, 'app')];
  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    const walk = (d) => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
          const code = fs.readFileSync(full, 'utf8');
          const rel = path.relative(projectRoot, full);
          const urls = code.match(/https?:\/\/[^\s'",`)]+/g) || [];
          for (const u of urls) {
            recordUrl(u, rel);
          }
        }
      }
    };
    walk(dir);
  }

  return {
    totalImages: totalCount,
    localImages: localCount,
    remoteImages: totalCount - localCount,
    uniqueHosts: hostCounts.size,
    hostCounts: Object.fromEntries(hostCounts),
    approvedHosts: Array.from(approvedHosts),
    unapprovedHosts: Array.from(unapprovedHosts),
    samplesByHost: Object.fromEntries(samplesByHost),
    isClean: unapprovedHosts.size === 0,
  };
}

// Run CLI directly if not imported as module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('================================================================');
  console.log('AL-HAMD SHOP — IMAGE HOST AUDIT REPORT (Task S11)');
  console.log('================================================================\n');

  const result = auditImageHosts();

  console.log(`Total Image References Audited: ${result.totalImages}`);
  console.log(`Local Images (/uploads, /placeholders, data URIs): ${result.localImages}`);
  console.log(`Remote Image References: ${result.remoteImages}`);
  console.log(`Unique Remote Hostnames: ${result.uniqueHosts}\n`);

  console.log('Approved Image Remote Patterns Hosts:');
  result.approvedHosts.forEach((h) => console.log(`  - [APPROVED] ${h}`));

  console.log('\nRemote Hosts Discovered:');
  if (Object.keys(result.hostCounts).length === 0) {
    console.log('  (None — 100% of image references are local / uploads / placeholders)');
  } else {
    for (const [hostname, count] of Object.entries(result.hostCounts)) {
      const isApproved = result.approvedHosts.includes(hostname);
      const status = isApproved ? 'APPROVED' : 'UNAPPROVED';
      console.log(`  - [${status}] ${hostname} (${count} references)`);
      if (!isApproved) {
        const info = result.samplesByHost[hostname];
        console.log(`      Sample: ${info.sample} (found in ${info.source})`);
      }
    }
  }

  console.log('\n----------------------------------------------------------------');
  if (result.isClean) {
    console.log('>>> STATUS: CLEAN — Zero unapproved remote image hosts detected. <<<');
    process.exit(0);
  } else {
    console.warn(`[WARNING] Found ${result.unapprovedHosts.length} unapproved remote image host(s)!`);
    if (process.argv.includes('--strict') || process.argv.includes('-s')) {
      process.exit(1);
    }
    process.exit(0);
  }
}
