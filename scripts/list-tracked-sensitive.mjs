import { execSync } from 'child_process';

const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const sensitivePatterns = [
  /^data\/.*\.json$/,
  /^\.env/,
  /^uploads\//,
  /^public\/uploads\/(?!.*\.gitkeep$).+/,
  /\.log$/,
  /^STEP.*-REPORT\.md$/,
  /^scripts\/test-/,
  /^scripts\/verify-/,
  /^_security_backups\//,
];

const trackedSensitive = trackedFiles.filter((f) => {
  if (f === '.env.example' || f === 'data/README.md') return false;
  return sensitivePatterns.some((p) => p.test(f));
});

console.log(`Tracked sensitive/dev files found: ${trackedSensitive.length}`);
for (const f of trackedSensitive) {
  console.log(`git rm --cached "${f}"`);
}

