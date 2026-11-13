const { execSync } = require('child_process');
const fs = require('fs');

process.env.CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const targetUrl = process.argv[2] || 'http://localhost:3000';
const outputPath = process.argv[3] || './lighthouse-report.json';

console.log(`Running Lighthouse on mobile viewport for ${targetUrl} ...`);
try {
  execSync(
    `npx lighthouse ${targetUrl} ` +
    `--output=json --output-path=${outputPath} ` +
    '--chrome-flags="--headless=new --no-sandbox" ' +
    '--form-factor=mobile ' +
    '--throttling-method=simulate ' +
    '--only-categories=performance,accessibility,best-practices,seo',
    { stdio: 'inherit' }
  );

  if (fs.existsSync(outputPath)) {
    const raw = fs.readFileSync(outputPath, 'utf8');
    const data = JSON.parse(raw);
    const scores = {
      targetUrl,
      performance: Math.round(data.categories.performance.score * 100),
      accessibility: Math.round(data.categories.accessibility.score * 100),
      bestPractices: Math.round(data.categories['best-practices'].score * 100),
      seo: Math.round(data.categories.seo.score * 100),
      lcp: data.audits['largest-contentful-paint'].displayValue,
      cls: data.audits['cumulative-layout-shift'].displayValue,
      fcp: data.audits['first-contentful-paint'].displayValue,
      speedIndex: data.audits['speed-index'].displayValue,
      tbt: data.audits['total-blocking-time'].displayValue,
      inp: data.audits['interactive'] ? data.audits['interactive'].displayValue : 'N/A'
    };
    console.log(`\n📊 LIGHTHOUSE MOBILE RESULTS FOR ${targetUrl}:`);
    console.log(JSON.stringify(scores, null, 2));
  }
} catch (err) {
  console.error('Lighthouse error:', err.message);
}
