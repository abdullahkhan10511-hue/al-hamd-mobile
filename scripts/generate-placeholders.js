const fs = require('fs');
const path = require('path');

function createSvg(title, subtitle, iconType) {
  let iconSvg = '';
  if (iconType === 'powerbank') {
    iconSvg = '<rect x="150" y="130" width="100" height="150" rx="16" fill="%23171717" stroke="%2338bdf8" stroke-width="4"/><circle cx="200" cy="245" r="8" fill="%2338bdf8"/><path d="M185 160h30v25h-30z" fill="%2338bdf8" opacity="0.6"/>';
  } else if (iconType === 'earbuds') {
    iconSvg = '<rect x="145" y="145" width="110" height="90" rx="28" fill="%23171717" stroke="%23a855f7" stroke-width="4"/><circle cx="175" cy="185" r="10" fill="%23a855f7"/><circle cx="225" cy="185" r="10" fill="%23a855f7"/>';
  } else if (iconType === 'charger') {
    iconSvg = '<rect x="150" y="145" width="100" height="100" rx="20" fill="%23171717" stroke="%23eab308" stroke-width="4"/><path d="M190 120v25m20-25v25" stroke="%23eab308" stroke-width="5" stroke-linecap="round"/><path d="M200 175l-10 20h20l-10 20" fill="none" stroke="%23eab308" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  } else if (iconType === 'case') {
    iconSvg = '<rect x="150" y="120" width="100" height="165" rx="22" fill="%23171717" stroke="%2310b981" stroke-width="4"/><rect x="160" y="135" width="35" height="35" rx="8" fill="%23262626"/><circle cx="177" cy="152" r="8" fill="%2310b981"/>';
  } else if (iconType === 'cable') {
    iconSvg = '<path d="M140 250c0-60 120-60 120-120" fill="none" stroke="%2306b6d4" stroke-width="6" stroke-linecap="round"/><rect x="125" y="240" width="30" height="18" rx="4" fill="%2306b6d4"/><rect x="245" y="115" width="30" height="18" rx="4" fill="%2306b6d4"/>';
  } else {
    iconSvg = '<rect x="145" y="130" width="110" height="145" rx="16" fill="%23171717" stroke="%23f43f5e" stroke-width="4"/><circle cx="200" cy="200" r="22" fill="%23262626"/><path d="M190 200h20M200 190v20" stroke="%23f43f5e" stroke-width="3" stroke-linecap="round"/>';
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#171717"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <rect x="20" y="20" width="360" height="360" rx="20" fill="none" stroke="#262626" stroke-width="2" stroke-dasharray="6 6"/>
  ${iconSvg}
  <text x="200" y="305" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#ffffff" letter-spacing="0.5">${title}</text>
  <text x="200" y="328" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#a3a3a3" letter-spacing="1">AL-HAMD SHOP • MANDI BAHAUDDIN</text>
  <text x="200" y="350" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="500" fill="#737373">Official Photo Coming Soon</text>
</svg>`;
}

const placeholders = [
  { name: 'earbuds.svg', title: 'TWS / Wireless Earbuds', sub: 'Audio Accessories', type: 'earbuds' },
  { name: 'powerbank.svg', title: 'Power Bank', sub: 'Fast Portable Charging', type: 'powerbank' },
  { name: 'charger.svg', title: 'Fast Wall Charger', sub: 'GaN & PD Adapters', type: 'charger' },
  { name: 'case.svg', title: 'Armor Protection Case', sub: 'Shockproof Cases', type: 'case' },
  { name: 'cable.svg', title: 'Braided Fast Cable', sub: 'USB-C & Lightning', type: 'cable' },
  { name: 'general.svg', title: 'Mobile Accessory', sub: 'AL-HAMD SHOP', type: 'general' },
];

placeholders.forEach(p => {
  fs.writeFileSync(path.join('public', 'placeholders', p.name), createSvg(p.title, p.sub, p.type), 'utf8');
  console.log('Generated placeholder:', p.name);
});

