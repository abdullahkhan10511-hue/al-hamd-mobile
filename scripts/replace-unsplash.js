const fs = require('fs');
const path = require('path');

const replacedItems = [];

// Helper to choose placeholder based on context
function getPlaceholder(categoryOrName = '') {
  const lower = categoryOrName.toLowerCase();
  if (lower.includes('earbud') || lower.includes('airpod') || lower.includes('tws') || lower.includes('audio') || lower.includes('headphone')) {
    return '/placeholders/earbuds.svg';
  }
  if (lower.includes('power bank') || lower.includes('powerbank') || lower.includes('battery')) {
    return '/placeholders/powerbank.svg';
  }
  if (lower.includes('charger') || lower.includes('adapter') || lower.includes('gan')) {
    return '/placeholders/charger.svg';
  }
  if (lower.includes('case') || lower.includes('cover') || lower.includes('armor') || lower.includes('kickstand')) {
    return '/placeholders/case.svg';
  }
  if (lower.includes('cable') || lower.includes('cord') || lower.includes('wire')) {
    return '/placeholders/cable.svg';
  }
  return '/placeholders/general.svg';
}

// 1. data/products.ts
{
  let file = fs.readFileSync('data/products.ts', 'utf8');
  const isCrlf = file.includes('\r\n');
  file = file.replace(/\r\n/g, '\n');

  file = file.replace(
    /images:\s*\[\s*'https:\/\/images\.unsplash\.com[^']+?'(?:,\s*'https:\/\/images\.unsplash\.com[^']+?')*\s*\]/g,
    (match) => {
      // Find nearby category or slug
      return match.replace(/'https:\/\/images\.unsplash\.com[^']+?'/g, (url) => {
        replacedItems.push({ file: 'data/products.ts', oldUrl: url, replacement: '/placeholders/general.svg' });
        return "'/placeholders/general.svg'";
      });
    }
  );

  // Map specific products to appropriate category placeholder
  file = file.replace(/(id:\s*'prod-15'[\s\S]*?images:\s*\[\s*)'\/placeholders\/general\.svg'/g, "$1'/placeholders/earbuds.svg'");
  file = file.replace(/(id:\s*'prod-16'[\s\S]*?images:\s*\[\s*)'\/placeholders\/general\.svg'/g, "$1'/placeholders/powerbank.svg'");
  file = file.replace(/(id:\s*'prod-chg-01'[\s\S]*?images:\s*\[\s*)'\/placeholders\/general\.svg'/g, "$1'/placeholders/charger.svg'");
  file = file.replace(/(id:\s*'prod-cbl-01'[\s\S]*?images:\s*\[\s*)'\/placeholders\/general\.svg'/g, "$1'/placeholders/cable.svg'");
  file = file.replace(/(id:\s*'prod-case-01'[\s\S]*?images:\s*\[\s*)'\/placeholders\/general\.svg'/g, "$1'/placeholders/case.svg'");

  fs.writeFileSync('data/products.ts', isCrlf ? file.replace(/\n/g, '\r\n') : file, 'utf8');
  console.log('✓ Replaced Unsplash in data/products.ts');
}

// 2. data/categories.ts
{
  let file = fs.readFileSync('data/categories.ts', 'utf8');
  const isCrlf = file.includes('\r\n');
  file = file.replace(/\r\n/g, '\n');

  file = file.replace(/image:\s*'https:\/\/images\.unsplash\.com[^']+?'/g, (match) => {
    return "image: '/placeholders/general.svg'";
  });

  file = file.replace(/(slug:\s*'chargers-adapters'[\s\S]*?image:\s*)'\/placeholders\/general\.svg'/g, "$1'/placeholders/charger.svg'");
  file = file.replace(/(slug:\s*'charging-cables'[\s\S]*?image:\s*)'\/placeholders\/general\.svg'/g, "$1'/placeholders/cable.svg'");
  file = file.replace(/(slug:\s*'cases-protection'[\s\S]*?image:\s*)'\/placeholders\/general\.svg'/g, "$1'/placeholders/case.svg'");
  file = file.replace(/(slug:\s*'power-banks'[\s\S]*?image:\s*)'\/placeholders\/general\.svg'/g, "$1'/placeholders/powerbank.svg'");
  file = file.replace(/(slug:\s*'tws-bluetooth-earbuds'[\s\S]*?image:\s*)'\/placeholders\/general\.svg'/g, "$1'/placeholders/earbuds.svg'");

  fs.writeFileSync('data/categories.ts', isCrlf ? file.replace(/\n/g, '\r\n') : file, 'utf8');
  console.log('✓ Replaced Unsplash in data/categories.ts');
}

// 3. app/layout.tsx
{
  let file = fs.readFileSync('app/layout.tsx', 'utf8');
  const isCrlf = file.includes('\r\n');
  file = file.replace(/\r\n/g, '\n');
  file = file.replace(
    /'https:\/\/images\.unsplash\.com\/photo-1583863788434-e58a36330cf0\?q=80&w=1200&auto=format&fit=crop'/g,
    "'/placeholders/general.svg'"
  );
  fs.writeFileSync('app/layout.tsx', isCrlf ? file.replace(/\n/g, '\r\n') : file, 'utf8');
  console.log('✓ Replaced Unsplash in app/layout.tsx');
}

// 4. components/home/ShopByCategories.tsx & app/categories/page.tsx
{
  ['components/home/ShopByCategories.tsx', 'app/categories/page.tsx'].forEach(p => {
    let file = fs.readFileSync(p, 'utf8');
    const isCrlf = file.includes('\r\n');
    file = file.replace(/\r\n/g, '\n');
    file = file.replace(
      /'https:\/\/images\.unsplash\.com\/photo-1601784551446-20c9e07cdbdb\?q=80&w=800&auto=format&fit=crop'/g,
      "'/placeholders/general.svg'"
    );
    fs.writeFileSync(p, isCrlf ? file.replace(/\n/g, '\r\n') : file, 'utf8');
    console.log(`✓ Replaced Unsplash in ${p}`);
  });
}

// 5. data/homepage-settings.json
{
  let file = fs.readFileSync('data/homepage-settings.json', 'utf8');
  file = file.replace(/https:\/\/images\.unsplash\.com\/[^\",\s]+/g, '/placeholders/general.svg');
  fs.writeFileSync('data/homepage-settings.json', file, 'utf8');
  console.log('✓ Replaced Unsplash in data/homepage-settings.json');
}

console.log('Finished updating Unsplash images.');

