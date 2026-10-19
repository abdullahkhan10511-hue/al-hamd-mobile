import fs from 'fs';
import path from 'path';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

console.log('\n======================================================');
console.log(' RUNNING VERIFICATION FOR MOBILE VIDEO & SLOW INTERNET');
console.log('======================================================\n');

// 1. HeroSection.tsx
console.log('--- TEST SUITE 1: Homepage Mobile Video Sizing & Preload ---');
const heroFile = fs.readFileSync(path.join(process.cwd(), 'components/home/HeroSection.tsx'), 'utf8');

assert(heroFile.includes('h-[100dvh] min-h-[500px]'), 'HeroSection provides full viewport immersive presentation (h-[100dvh] min-h-[500px])');
assert(!heroFile.includes('h-[45vh] min-h-[220px] max-h-[380px]'), 'HeroSection does not unnecessarily shrink video dimensions on mobile');
assert(heroFile.includes('isSlowConnection'), 'HeroSection detects slow cellular network or Data Saver mode');
assert(heroFile.includes('preload={isSlowConnection || prefersReducedMotion ? \'none\' : \'metadata\'}'), 'HeroSection uses network-aware video preloading');
assert(heroFile.includes('activeVideo.thumbnailUrl'), 'HeroSection integrates poster and thumbnail fallback');
assert(heroFile.includes('bottom-8 sm:bottom-10'), 'Bottom controls and indicators are positioned with proper immersive spacing');

// 2. Product Page Video Optimization
console.log('\n--- TEST SUITE 2: Product Page Media Optimization ---');
const productPageFile = fs.readFileSync(path.join(process.cwd(), 'app/product/[slug]/page.tsx'), 'utf8');

assert(!productPageFile.includes('<video\n                          src={item.url}\n                          muted\n                          preload="metadata"'), 'Product thumbnail buttons do not mount live video tags');
assert(productPageFile.includes('sizes="80px"'), 'Product media thumbnails declare explicit sizes for optimal responsive delivery');
assert(productPageFile.includes('preload="metadata"') && productPageFile.includes('controls'), 'Active product video player uses non-blocking preload="metadata"');

// 3. Next.js Config & Compression
console.log('\n--- TEST SUITE 3: Next.js Performance & Compression Settings ---');
const nextConfigFile = fs.readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8');

assert(nextConfigFile.includes('compress: true'), 'next.config.ts enables gzip/brotli asset compression');
assert(nextConfigFile.includes('minimumCacheTTL: 60 * 60 * 24 * 30'), 'next.config.ts configures 30-day image cache TTL');
assert(nextConfigFile.includes('formats: [\'image/avif\', \'image/webp\']'), 'next.config.ts serves modern WebP & AVIF formats');

// 4. Client Sync & HTTP Caching
console.log('\n--- TEST SUITE 4: Public API HTTP Caching ---');
const productsDbFile = fs.readFileSync(path.join(process.cwd(), 'lib/db/products.ts'), 'utf8');
const categoriesDbFile = fs.readFileSync(path.join(process.cwd(), 'lib/db/categories.ts'), 'utf8');
const brandsDbFile = fs.readFileSync(path.join(process.cwd(), 'lib/db/brands.ts'), 'utf8');

assert(!productsDbFile.includes("fetch('/api/products', { cache: 'no-store' })"), 'lib/db/products.ts allows HTTP caching for public products sync');
assert(!categoriesDbFile.includes("fetch('/api/categories', { cache: 'no-store' })"), 'lib/db/categories.ts allows HTTP caching for public categories sync');
assert(!brandsDbFile.includes("fetch('/api/brands', { cache: 'no-store' })"), 'lib/db/brands.ts allows HTTP caching for public brands sync');

console.log('\n======================================================');
console.log(` RESULTS: ${passCount} passed, ${failCount} failed out of ${passCount + failCount} total tests.`);
console.log('======================================================\n');

if (failCount > 0) {
  process.exit(1);
}
