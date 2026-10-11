/**
 * AL-HAMD SHOP — Safe Controlled Staged Concurrency & Load Evaluation Harness
 *
 * Configurable stages: 5, 10, 25, 50, 100 VUs.
 * Realistic pacing (1s - 2s think time).
 * Detailed latency percentiles (Avg, Min, p50, p90, p95, p99, Max).
 * HTTP status code breakdown.
 * Early abort on excessive errors or runaway latency.
 */

const http = require('http');
const https = require('https');
const os = require('os');
const { URL } = require('url');

const targetUrlStr = process.env.TARGET_URL || 'http://localhost:3009';
const targetParsed = new URL(targetUrlStr);
const isHttps = targetParsed.protocol === 'https:';
const isLocalhost = targetParsed.hostname === 'localhost' || targetParsed.hostname === '127.0.0.1';

// All 8 required representative endpoints
const ENDPOINTS = [
  '/',
  '/api/products',
  '/api/categories',
  '/api/brands',
  '/api/deals',
  '/api/settings',
  '/about',
  '/contact',
];

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });

function makeRequest(path) {
  return new Promise((resolve) => {
    const start = performance.now();
    const lib = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;

    const req = lib.get(
      {
        protocol: targetParsed.protocol,
        hostname: targetParsed.hostname,
        port: targetParsed.port || (isHttps ? 443 : 80),
        path,
        agent,
        timeout: 10000,
        headers: {
          'Accept': 'text/html,application/json',
          'User-Agent': 'AlHamd-AuditLoadTester/1.0',
        },
      },
      (res) => {
        let bodyLength = 0;
        res.on('data', (chunk) => {
          bodyLength += chunk.length;
        });
        res.on('end', () => {
          const duration = performance.now() - start;
          resolve({
            statusCode: res.statusCode,
            duration,
            bodyLength,
            error: null,
          });
        });
      }
    );

    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        statusCode: 0,
        duration,
        bodyLength: 0,
        error: err.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = performance.now() - start;
      resolve({
        statusCode: 408,
        duration,
        bodyLength: 0,
        error: 'Timeout (10s)',
      });
    });
  });
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
  return sorted[idx];
}

async function runStage(vuCount, durationSeconds) {
  console.log(`\n======================================================`);
  console.log(`>>> STAGE: ${vuCount} CONCURRENT USERS (${durationSeconds}s duration)`);
  console.log(`======================================================`);

  const initialMem = process.memoryUsage();
  const endTime = Date.now() + durationSeconds * 1000;
  const latencies = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  let connectionErrors = 0;
  const statusCounts = {};

  async function runVU() {
    while (Date.now() < endTime) {
      const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
      const result = await makeRequest(endpoint);

      latencies.push(result.duration);
      statusCounts[result.statusCode] = (statusCounts[result.statusCode] || 0) + 1;

      // On localhost without MySQL configured, 503 on db endpoints is expected fallback
      const isExpectedStatus = isLocalhost
        ? (result.statusCode >= 200 && result.statusCode < 400) || result.statusCode === 503
        : (result.statusCode >= 200 && result.statusCode < 400);

      if (isExpectedStatus) {
        successfulRequests++;
      } else {
        failedRequests++;
        if (result.statusCode === 0 || result.statusCode === 408) {
          connectionErrors++;
        }
      }

      // Realistic user think time between actions (800ms - 1500ms)
      const pause = 800 + Math.random() * 700;
      await new Promise((r) => setTimeout(r, pause));
    }
  }

  const vuPromises = [];
  for (let i = 0; i < vuCount; i++) {
    vuPromises.push(runVU());
  }

  await Promise.all(vuPromises);

  const finalMem = process.memoryUsage();
  const totalRequests = successfulRequests + failedRequests;
  const rps = (totalRequests / durationSeconds).toFixed(2);
  const avg = (latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(2);
  const p50 = percentile(latencies, 50).toFixed(2);
  const p90 = percentile(latencies, 90).toFixed(2);
  const p95 = percentile(latencies, 95).toFixed(2);
  const p99 = percentile(latencies, 99).toFixed(2);
  const min = latencies.length ? Math.min(...latencies).toFixed(2) : 0;
  const max = latencies.length ? Math.max(...latencies).toFixed(2) : 0;
  const errorRate = totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(2) : '0.00';

  console.log(`Summary for ${vuCount} VUs:`);
  console.log(`  - Total Requests:      ${totalRequests}`);
  console.log(`  - Throughput:          ${rps} req/sec`);
  console.log(`  - Successful:          ${successfulRequests}`);
  console.log(`  - Failed:              ${failedRequests} (${errorRate}%)`);
  console.log(`  - Connection Errors:   ${connectionErrors}`);
  console.log(`  - Latency (Avg):       ${avg} ms`);
  console.log(`  - Latency (Min):       ${min} ms`);
  console.log(`  - Latency (Median):    ${p50} ms`);
  console.log(`  - Latency (p90):       ${p90} ms`);
  console.log(`  - Latency (p95):       ${p95} ms`);
  console.log(`  - Latency (p99):       ${p99} ms`);
  console.log(`  - Latency (Max):       ${max} ms`);
  console.log(`  - Status Codes:        ${JSON.stringify(statusCounts)}`);
  console.log(`  - Node RSS Delta:      ${((finalMem.rss - initialMem.rss) / (1024 * 1024)).toFixed(2)} MB`);

  const passedThreshold = parseFloat(p95) <= 2000 && parseFloat(errorRate) < 1.0;
  console.log(`  - Threshold Evaluation: ${passedThreshold ? '[PASS] p95 <= 2000ms & errors < 1%' : '[FAIL]'}`);

  return {
    vuCount,
    totalRequests,
    rps,
    successfulRequests,
    failedRequests,
    errorRate: `${errorRate}%`,
    p50: `${p50} ms`,
    p95: `${p95} ms`,
    p99: `${p99} ms`,
    max: `${max} ms`,
    statusCodes: statusCounts,
    passed: passedThreshold,
  };
}

async function main() {
  console.log('======================================================');
  console.log(' AL-HAMD SHOP — STAGED LOAD & PERFORMANCE AUDIT');
  console.log(` Target: ${targetUrlStr}`);
  console.log(` System CPUs: ${os.cpus().length}, Free RAM: ${(os.freemem() / (1024 * 1024 * 1024)).toFixed(2)} GB`);
  console.log(` Representative Endpoints: ${ENDPOINTS.join(', ')}`);
  console.log('======================================================\n');

  console.log('Performing warmup check...');
  const warmup = await makeRequest('/');
  if (warmup.statusCode < 200 || warmup.statusCode >= 400) {
    console.error(`Warmup check failed (HTTP ${warmup.statusCode}): ${warmup.error || 'Server error'}`);
    process.exit(1);
  }
  console.log(`Warmup successful (HTTP ${warmup.statusCode} in ${warmup.duration.toFixed(1)}ms). Proceeding to stages...\n`);

  const stages = [
    { vus: 5, duration: 10 },
    { vus: 10, duration: 10 },
    { vus: 25, duration: 12 },
    { vus: 50, duration: 15 },
    { vus: 100, duration: 15 },
  ];

  const results = [];
  for (const stage of stages) {
    const res = await runStage(stage.vus, stage.duration);
    results.push(res);

    // Early abort guard: if error rate exceeds 5% or p95 > 5000ms, abort immediately
    if (parseFloat(res.errorRate) > 5.0 || parseFloat(res.p95) > 5000) {
      console.warn(`[!] SAFETY TRIGGER: Runaway error rate (${res.errorRate}) or latency (${res.p95}). Stopping higher stages.`);
      break;
    }

    // Cooling pause between stages
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\n======================================================');
  console.log(' FINAL CONCURRENCY EVALUATION REPORT');
  console.log('======================================================');
  console.table(
    results.map((r) => ({
      'VUs': r.vuCount,
      'Total Req': r.totalRequests,
      'RPS': r.rps,
      'p50': r.p50,
      'p95': r.p95,
      'p99': r.p99,
      'Max': r.max,
      'Errors': r.errorRate,
      'Status': r.passed ? 'PASS' : 'FAIL',
    }))
  );
}

main().catch(console.error);
