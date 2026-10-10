/**
 * AL-HAMD SHOP — Staged Concurrency Evaluation Harness
 * Runs safe read-only public endpoints against target server.
 * Supports both HTTP (localhost) and HTTPS (remote).
 * Stages: 5, 10, 25, 50, 100 Virtual Users.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const targetUrlStr = process.env.TARGET_URL || 'http://localhost:3009';
const targetParsed = new URL(targetUrlStr);
const isHttps = targetParsed.protocol === 'https:';

const isLocalhost = targetParsed.hostname === 'localhost' || targetParsed.hostname === '127.0.0.1';

const ENDPOINTS = isLocalhost
  ? ['/', '/api/deals', '/api/settings', '/api/favicon', '/about', '/contact']
  : ['/', '/api/products', '/api/categories', '/api/brands', '/api/deals', '/api/settings'];

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 200 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 200 });

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
          'User-Agent': 'AlHamd-LoadTester/1.0',
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
  console.log(`>>> RUNNING STAGE: ${vuCount} CONCURRENT USERS (${durationSeconds}s)`);
  console.log(`======================================================`);

  const endTime = Date.now() + durationSeconds * 1000;
  const latencies = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  const statusCounts = {};

  // Worker loop simulating a single virtual user with realistic pacing
  async function runVU() {
    while (Date.now() < endTime) {
      const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
      const result = await makeRequest(endpoint);

      latencies.push(result.duration);
      statusCounts[result.statusCode] = (statusCounts[result.statusCode] || 0) + 1;

      if (result.statusCode >= 200 && result.statusCode < 400) {
        successfulRequests++;
      } else {
        failedRequests++;
      }

      // Realistic pacing between requests
      const pause = 100 + Math.random() * 200;
      await new Promise((r) => setTimeout(r, pause));
    }
  }

  const vuPromises = [];
  for (let i = 0; i < vuCount; i++) {
    vuPromises.push(runVU());
  }

  await Promise.all(vuPromises);

  const totalRequests = successfulRequests + failedRequests;
  const rps = (totalRequests / durationSeconds).toFixed(2);
  const p50 = percentile(latencies, 50).toFixed(2);
  const p90 = percentile(latencies, 90).toFixed(2);
  const p95 = percentile(latencies, 95).toFixed(2);
  const p99 = percentile(latencies, 99).toFixed(2);
  const min = latencies.length ? Math.min(...latencies).toFixed(2) : 0;
  const max = latencies.length ? Math.max(...latencies).toFixed(2) : 0;
  const errorRate = totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(2) : '0.00';

  console.log(`Summary for ${vuCount} VUs:`);
  console.log(`  - Total Requests:      ${totalRequests}`);
  console.log(`  - Successful:          ${successfulRequests}`);
  console.log(`  - Failed:              ${failedRequests} (${errorRate}%)`);
  console.log(`  - Throughput:          ${rps} req/sec`);
  console.log(`  - Latency (Min):       ${min} ms`);
  console.log(`  - Latency (Median):    ${p50} ms`);
  console.log(`  - Latency (p90):       ${p90} ms`);
  console.log(`  - Latency (p95):       ${p95} ms`);
  console.log(`  - Latency (p99):       ${p99} ms`);
  console.log(`  - Latency (Max):       ${max} ms`);
  console.log(`  - Status Codes:        ${JSON.stringify(statusCounts)}`);

  const passed = parseFloat(p95) <= 2000 && parseFloat(errorRate) < 1.0;
  console.log(`  - Threshold Evaluation: ${passed ? '[PASS] p95 <= 2000ms & errors < 1%' : '[FAIL]'}`);

  return {
    vuCount,
    totalRequests,
    successfulRequests,
    failedRequests,
    errorRate: `${errorRate}%`,
    rps,
    p50: `${p50} ms`,
    p95: `${p95} ms`,
    p99: `${p99} ms`,
    passed,
  };
}

async function main() {
  console.log(`Testing target: ${targetUrlStr}`);
  console.log(`Target endpoints: ${ENDPOINTS.join(', ')}`);

  console.log('Testing connection to target server...');
  const warmup = await makeRequest('/');
  if (warmup.statusCode < 200 || warmup.statusCode >= 400) {
    console.error(`Warmup failed with status ${warmup.statusCode}: ${warmup.error || 'Server error'}`);
    process.exit(1);
  }
  console.log(`Server responded (Status ${warmup.statusCode} in ${warmup.duration.toFixed(1)}ms). Initializing staged testing...\n`);

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
    // Pause 3 seconds between stages for connection pool settling
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log('\n======================================================');
  console.log(' FINAL CONCURRENCY EVALUATION REPORT');
  console.log('======================================================');
  console.table(results);
}

main().catch(console.error);
