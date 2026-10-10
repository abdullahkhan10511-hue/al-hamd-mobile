import http from 'k6/http';
import { check, sleep } from 'k6';

// Staged concurrency load test configuration
export const options = {
  stages: [
    { duration: '15s', target: 5 },   // Stage 1: 5 VUs
    { duration: '20s', target: 10 },  // Stage 2: 10 VUs
    { duration: '25s', target: 25 },  // Stage 3: 25 VUs
    { duration: '30s', target: 50 },  // Stage 4: 50 VUs
    { duration: '30s', target: 100 }, // Stage 5: 100 VUs
    { duration: '15s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // p95 response time <= 2s
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3009';

const ENDPOINTS = [
  '/',
  '/api/products',
  '/api/categories',
  '/api/brands',
  '/api/deals',
  '/api/settings',
];

export default function () {
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const url = `${BASE_URL}${endpoint}`;

  const res = http.get(url, {
    headers: {
      'Accept': 'text/html,application/json',
      'User-Agent': 'k6-load-test/1.0 (Al-Hamd Concurrency Evaluation)',
    },
    timeout: '10s',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response under 2s': (r) => r.timings.duration < 2000,
  });

  // Realistic user think time between actions (1s - 2s)
  sleep(1 + Math.random());
}
