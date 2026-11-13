const fs = require('fs');

// Fix 1: lib/db/pages.ts
{
  let content = fs.readFileSync('lib/db/pages.ts', 'utf8');
  const findStr = `    const res = await fetch('/api/admin/pages', {
      cache: 'no-store',
      headers: getAdminAuthHeaders(),
    });`;

  const replaceStr = `    const hasAdminToken = Boolean(
      (typeof sessionStorage !== 'undefined' && (sessionStorage.getItem('alhamd_admin_token') || sessionStorage.getItem('alhamd_admin_session'))) ||
      (typeof localStorage !== 'undefined' && (localStorage.getItem('alhamd_admin_token') || localStorage.getItem('alhamd_admin_session')))
    );

    if (hasAdminToken) {
      const res = await fetch('/api/admin/pages', {
        cache: 'no-store',
        headers: getAdminAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.pages) && data.pages.length > 0) {
          await setStoredData(STORAGE_KEY, data.pages);
          window.dispatchEvent(new CustomEvent('alhamd:data-updated'));
          return;
        }
      }
    }`;

  // Normalize CRLF to LF for matching
  const isCrlf = content.includes('\r\n');
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const normalizedFind = findStr.replace(/\r\n/g, '\n');
  const normalizedReplace = replaceStr.replace(/\r\n/g, '\n');

  if (normalizedContent.includes(normalizedFind)) {
    const updated = normalizedContent.replace(normalizedFind, normalizedReplace);
    fs.writeFileSync('lib/db/pages.ts', isCrlf ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
    console.log('Fixed lib/db/pages.ts');
  } else {
    console.warn('Could not find target in lib/db/pages.ts');
  }
}

// Fix 2: lib/db/products.ts - remove purging of valid products prod-15 & prod-16
{
  let content = fs.readFileSync('lib/db/products.ts', 'utf8');
  const isCrlf = content.includes('\r\n');
  const normalizedContent = content.replace(/\r\n/g, '\n');

  const findStr = `    list = list.filter(
      (p) =>
        p &&
        p.slug !== 'essential-hoodie' &&
        p.slug !== 'air-max-270' &&
        !(p.id === 'prod-15' && p.slug === 'apple-airpods-pro-2' && (p as any).sku === 'AP-APP2-015') &&
        !(p.id === 'prod-16' && p.slug === 'anker-20000mah-power-bank')
    );`;

  const replaceStr = `    list = list.filter(
      (p) =>
        p &&
        p.slug !== 'essential-hoodie' &&
        p.slug !== 'air-max-270'
    );`;

  const normalizedFind = findStr.replace(/\r\n/g, '\n');
  const normalizedReplace = replaceStr.replace(/\r\n/g, '\n');

  if (normalizedContent.includes(normalizedFind)) {
    const updated = normalizedContent.replace(normalizedFind, normalizedReplace);
    fs.writeFileSync('lib/db/products.ts', isCrlf ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
    console.log('Fixed lib/db/products.ts');
  } else {
    console.warn('Could not find target in lib/db/products.ts');
  }
}

