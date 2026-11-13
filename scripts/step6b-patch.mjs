import fs from 'fs';

const files = [
  'components/admin/CreateShopBillModal.tsx',
  'app/admin/homepage-videos/page.tsx',
  'app/admin/orders/page.tsx',
  'app/admin/pos/page.tsx',
  'app/admin/settings/seo/page.tsx',
  'app/admin/shop-inventory/page.tsx',
  'app/admin/wholesale/page.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/from '@\/lib\/db\/staff';/g, "from '@/lib/permissions';");
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated:', file);
}

