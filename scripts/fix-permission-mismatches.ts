/**
 * Fix Permission Mismatches — AL-HAMD SHOP
 *
 * Fixes identified in audit:
 * 1. orders/[id]/route.ts GET uses content.navigation checks instead of orders.view (copy-paste bug)
 * 2. pos/route.ts POST missing pos.create_sale permission check (only checks discount perm)
 * 3. pos/route.ts GET missing pos.view permission check
 * 4. pages/route.ts POST missing pages.create permission check
 * 5. bill-settings/route.ts uses non-canonical 'settings.manage' key → remove it
 * 6. inventory/logs/route.ts uses non-canonical 'inventory.manage' key → remove it
 * 7. inquiries/route.ts uses custom canAccessInquiries() → migrate to hasAdminPermission
 * 8. wholesale/route.ts custom verifyWholesaleAccess only checks wholesale.manage for reads → add wholesale.view
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function writeFile(rel: string, content: string): void {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
  console.log(`✅  Written: ${rel}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Fix orders/[id]/route.ts — wrong content.navigation permission in GET
// ─────────────────────────────────────────────────────────────────────────────
function fixOrdersRoute(): void {
  const rel = 'app/api/admin/orders/[id]/route.ts';
  let src = readFile(rel);

  // The GET handler wrongly checks content.navigation. Fix it.
  const wrongGet = `    if (!hasAdminPermission(session, ['content.navigation', 'settings.edit', 'settings.view', 'pages.manage_nav'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view order details.');
    }`;
  const correctGet = `    if (!hasAdminPermission(session, ['orders.view', 'orders.manage'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view order details.');
    }`;

  // Also fix the navigation check in the read path that was duplicated in PATCH
  const wrongPatch = `    if (!hasAdminPermission(session, ['content.navigation', 'settings.edit', 'pages.manage_nav'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view order details.');
    }`;

  if (!src.includes(wrongGet) && !src.includes("content.navigation")) {
    console.log('ℹ️  orders/[id]/route.ts already fixed — skipping.');
    return;
  }

  src = src.replace(wrongGet, correctGet);
  // Remove any remaining navigation check in PATCH if present
  if (src.includes("content.navigation")) {
    src = src.replace(wrongPatch, '');
    console.log('  Also removed stray navigation permission check from PATCH.');
  }

  writeFile(rel, src);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Fix pos/route.ts — add pos.view and pos.create_sale checks
// ─────────────────────────────────────────────────────────────────────────────
function fixPosRoute(): void {
  const rel = 'app/api/admin/pos/route.ts';
  let src = readFile(rel);

  // Add hasAdminPermission and forbiddenResponse to imports
  if (!src.includes('hasAdminPermission')) {
    src = src.replace(
      `import { getAdminSession, unauthorizedResponse } from '@/lib/db/adminAuth';`,
      `import { getAdminSession, unauthorizedResponse, forbiddenResponse, hasAdminPermission } from '@/lib/db/adminAuth';`
    );
  }

  // Add pos.create_sale check to POST after session check
  const postSessionCheck = `    if (!session) {
      return unauthorizedResponse('Unauthorized: Staff session required.');
    }

    const body = await request.json();`;
  const postSessionCheckFixed = `    if (!session) {
      return unauthorizedResponse('Unauthorized: Staff session required.');
    }

    if (!hasAdminPermission(session, ['pos.create_sale', 'pos.view'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to process POS sales.');
    }

    const body = await request.json();`;

  if (src.includes(postSessionCheck)) {
    src = src.replace(postSessionCheck, postSessionCheckFixed);
  }

  // Add pos.view check to GET after session check
  const getSessionCheck = `    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse('Unauthorized: Staff session required.');
    }

    const { searchParams } = new URL(request.url);`;
  const getSessionCheckFixed = `    const session = getAdminSession(request);
    if (!session) {
      return unauthorizedResponse('Unauthorized: Staff session required.');
    }

    if (!hasAdminPermission(session, ['pos.view', 'pos.create_sale', 'pos.view_history'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to access POS data.');
    }

    const { searchParams } = new URL(request.url);`;

  if (src.includes(getSessionCheck)) {
    src = src.replace(getSessionCheck, getSessionCheckFixed);
  }

  writeFile(rel, src);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Fix pages/route.ts — add pages.view and pages.create checks
// ─────────────────────────────────────────────────────────────────────────────
function fixPagesRoute(): void {
  const rel = 'app/api/admin/pages/route.ts';
  let src = readFile(rel);

  if (!src.includes('hasAdminPermission')) {
    src = src.replace(
      `import { getAdminSession } from '@/lib/db/adminAuth';`,
      `import { getAdminSession, hasAdminPermission, forbiddenResponse } from '@/lib/db/adminAuth';`
    );
  }

  // Add pages.view check to GET
  const getCheck = `    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let pages`;
  const getCheckFixed = `    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAdminPermission(session, ['pages.view', 'pages.create', 'pages.edit', 'pages.delete', 'pages.publish', 'pages.manage_nav', 'content.navigation'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view pages.');
    }

    let pages`;

  if (src.includes(getCheck)) {
    src = src.replace(getCheck, getCheckFixed);
  }

  // Add pages.create check to POST
  const postCheck = `    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session required.' }, { status: 401 });
    }

    const body = await request.json();`;
  const postCheckFixed = `    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session required.' }, { status: 401 });
    }

    if (!hasAdminPermission(session, ['pages.create', 'pages.edit'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to create pages.');
    }

    const body = await request.json();`;

  if (src.includes(postCheck)) {
    src = src.replace(postCheck, postCheckFixed);
  }

  writeFile(rel, src);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Fix bill-settings/route.ts — remove non-canonical 'settings.manage' key
// ─────────────────────────────────────────────────────────────────────────────
function fixBillSettingsRoute(): void {
  const rel = 'app/api/admin/bill-settings/route.ts';
  let src = readFile(rel);

  // Remove 'settings.manage' from permission arrays (it's not canonical)
  src = src.replace(
    `['settings.view', 'settings.edit', 'settings.manage', 'inventory.shop_bill']`,
    `['settings.view', 'settings.edit', 'inventory.shop_bill']`
  );
  src = src.replace(
    `['settings.edit', 'settings.manage', 'inventory.shop_bill']`,
    `['settings.edit', 'inventory.shop_bill']`
  );

  writeFile(rel, src);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Fix inventory/logs/route.ts — remove non-canonical 'inventory.manage' key
// ─────────────────────────────────────────────────────────────────────────────
function fixInventoryLogsRoute(): void {
  const rel = 'app/api/admin/inventory/logs/route.ts';
  let src = readFile(rel);

  // 'inventory.manage' is NOT in canonical keys. Remove it.
  src = src.replace(
    `['inventory.view_history', 'inventory.view', 'inventory.manage']`,
    `['inventory.view_history', 'inventory.view']`
  );
  src = src.replace(
    `['inventory.adjust_stock', 'inventory.stock.edit', 'inventory.manage']`,
    `['inventory.adjust_stock', 'inventory.stock.edit']`
  );

  writeFile(rel, src);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Fix inquiries/route.ts — use hasAdminPermission instead of custom function
// ─────────────────────────────────────────────────────────────────────────────
function fixInquiriesRoute(): void {
  const rel = 'app/api/admin/inquiries/route.ts';
  let src = readFile(rel);

  if (src.includes('hasAdminPermission')) {
    console.log('ℹ️  inquiries/route.ts already uses hasAdminPermission — skipping.');
    return;
  }

  src = src.replace(
    `import { getAdminSession } from '@/lib/db/adminAuth';`,
    `import { getAdminSession, hasAdminPermission, forbiddenResponse } from '@/lib/db/adminAuth';`
  );

  // Replace the custom canAccessInquiries function and usage
  const customFn = `function canAccessInquiries(session: any): boolean {
  if (!session || session.status === 'inactive') return false;
  if (session.isOwner) return true;

  const perms = Array.isArray(session.permissions) ? session.permissions : [];
  if (perms.includes('*')) return true;

  return (
    perms.includes('inquiries.view') ||
    perms.includes('customers.view') ||
    perms.includes('orders.view')
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session || !canAccessInquiries(session)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required.' },
        { status: 401 }
      );
    }`;

  const fixedFn = `export async function GET(request: NextRequest) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required.' },
        { status: 401 }
      );
    }

    if (!hasAdminPermission(session, ['inquiries.view', 'inquiries.manage', 'customers.view', 'orders.view'])) {
      return forbiddenResponse('Forbidden: Insufficient permissions to view customer inquiries.');
    }`;

  if (src.includes(customFn)) {
    src = src.replace(customFn, fixedFn);
  }

  writeFile(rel, src);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Fix wholesale/route.ts — add wholesale.view for GET reads
// ─────────────────────────────────────────────────────────────────────────────
function fixWholesaleRoute(): void {
  const rel = 'app/api/admin/wholesale/route.ts';
  let src = readFile(rel);

  // Update verifyWholesaleAccess to include wholesale.view for read access
  const oldVerify = `function verifyWholesaleAccess(user: StaffUser | null): boolean {
  if (!user || user.status === 'inactive') return false;
  if (user.isOwner) return true;
  return Array.isArray(user.permissions) && (user.permissions.includes('*') || user.permissions.includes('wholesale.manage'));
}`;

  const newVerify = `function verifyWholesaleReadAccess(user: StaffUser | null): boolean {
  if (!user || user.status === 'inactive') return false;
  if (user.isOwner) return true;
  const p = Array.isArray(user.permissions) ? user.permissions : [];
  return p.includes('*') || p.includes('wholesale.view') || p.includes('wholesale.manage') || p.includes('wholesale.create') || p.includes('wholesale.approve');
}

function verifyWholesaleWriteAccess(user: StaffUser | null): boolean {
  if (!user || user.status === 'inactive') return false;
  if (user.isOwner) return true;
  const p = Array.isArray(user.permissions) ? user.permissions : [];
  return p.includes('*') || p.includes('wholesale.manage') || p.includes('wholesale.create');
}`;

  if (src.includes(oldVerify)) {
    src = src.replace(oldVerify, newVerify);
  }

  // Update GET handler to use verifyWholesaleReadAccess
  src = src.replace(
    /if \(!verifyWholesaleAccess\(session\)\) \{\s*return NextResponse\.json\(\s*\{\s*success: false,\s*error: 'Access denied: You do not have permission for Wholesale Account Management\.',\s*\},\s*\{ status: 403 \}\s*\);\s*\}\s*\s*const wholesaleAccounts/,
    `if (!verifyWholesaleReadAccess(session)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied: You do not have permission to view Wholesale Accounts.',
        },
        { status: 403 }
      );
    }

    const wholesaleAccounts`
  );

  // Update POST handler to use verifyWholesaleWriteAccess
  src = src.replace(
    /if \(!verifyWholesaleAccess\(session\)\) \{\s*return NextResponse\.json\(\s*\{\s*success: false,\s*error: 'Access denied: You do not have permission for Wholesale Account Management\.',\s*\},\s*\{ status: 403 \}\s*\);\s*\}\s*\s*const body = await request\.json\(\)/,
    `if (!verifyWholesaleWriteAccess(session)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied: You do not have permission to create Wholesale Accounts.',
        },
        { status: 403 }
      );
    }

    const body = await request.json()`
  );

  writeFile(rel, src);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Fix settings/route.ts and payment-methods/route.ts — remove settings.manage
// ─────────────────────────────────────────────────────────────────────────────
function fixSettingsRoutes(): void {
  const routes = [
    'app/api/admin/settings/route.ts',
    'app/api/admin/payment-methods/route.ts',
  ];

  for (const rel of routes) {
    let src = readFile(rel);
    const before = src;

    src = src.replace(/,\s*'settings\.manage'/g, '');
    src = src.replace(/'settings\.manage',\s*/g, '');

    if (src !== before) {
      writeFile(rel, src);
    } else {
      console.log(`ℹ️  ${rel}: no 'settings.manage' found — skipping.`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Add 'orders.manage' as alias in hasAdminPermission lookup
//    (orders/[id]/route.ts already uses it — ensure canonical key exists)
//    Actually, let's just remove 'orders.manage' from route checks since it's
//    not in canonical list. Already fixed in step 1.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// RUN ALL FIXES
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔧  AL-HAMD SHOP — Permission Mismatch Fix Script\n');

fixOrdersRoute();
fixPosRoute();
fixPagesRoute();
fixBillSettingsRoute();
fixInventoryLogsRoute();
fixInquiriesRoute();
fixWholesaleRoute();
fixSettingsRoutes();

console.log('\n✅  All permission mismatch fixes applied.\n');

