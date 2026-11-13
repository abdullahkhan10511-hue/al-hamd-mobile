import http from 'http';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';

async function fetchUrl(path: string): Promise<{ status: number; text: string; timeMs: number; headers: any }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          text: data,
          timeMs: Date.now() - start,
          headers: res.headers,
        });
      });
    });
    req.on('error', (err) => {
      resolve({ status: 500, text: err.message, timeMs: Date.now() - start, headers: {} });
    });
  });
}

const routes = [
  '/',
  '/shop',
  '/product/anker-20000mah-power-bank',
  '/brand/anker',
  '/category/power-banks',
  '/brands',
  '/categories',
  '/new-arrivals',
  '/best-sellers',
  '/wishlist',
  '/login',
  '/contact',
  '/about',
  '/shipping-policy',
  '/refund-policy',
  '/privacy-policy',
  '/terms',
  '/cart',
  '/checkout'
];

async function run() {
  console.log('🔍 Testing all required routes on http://localhost:3000...\n');
  const results: any[] = [];

  for (const r of routes) {
    const res = await fetchUrl(r);
    const hasH1 = (res.text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || []).length;
    const hasCanonical = res.text.includes('rel="canonical"');
    const hasJsonLd = res.text.includes('application/ld+json');
    const hasUnsplash = res.text.includes('images.unsplash.com');
    const hasFakeRating = res.text.includes('50,000+') || res.text.includes('4.9/5');
    const titleMatch = res.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'NO TITLE';

    results.push({
      route: r,
      status: res.status,
      timeMs: res.timeMs,
      sizeBytes: res.text.length,
      h1Count: hasH1,
      hasCanonical,
      hasJsonLd,
      hasUnsplash,
      hasFakeRating,
      title
    });

    console.log(`[${res.status}] ${r.padEnd(40)} ${res.timeMs}ms | ${res.text.length} bytes | H1: ${hasH1} | Unsplash: ${hasUnsplash ? 'YES' : 'NO'}`);
  }

  fs.writeFileSync('./audit-routes-results.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\nResults saved to audit-routes-results.json');
}

run();

