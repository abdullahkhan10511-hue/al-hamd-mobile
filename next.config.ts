import type { NextConfig } from "next";

/**
 * Builds safe image remotePatterns strictly restricted to:
 * 1. The store's own domain(s): alhamdshop.com, www.alhamdshop.com, NEXT_PUBLIC_APP_URL
 * 2. 'localhost' ONLY when NODE_ENV !== 'production' (strictly excluded in production)
 * 3. Optional comma-separated hosts from process.env.IMAGE_REMOTE_HOSTS (empty by default)
 * Zero wildcard or unauthorized external image hosts.
 */
function getImageRemotePatterns(): NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> {
  const allowedHosts = new Set<string>(['alhamdshop.com', 'www.alhamdshop.com']);

  // Only allow localhost during non-production development / testing
  if (process.env.NODE_ENV !== 'production') {
    allowedHosts.add('localhost');
  }

  // Extract hostname from configured app URLs if present
  const appUrls = [process.env.NEXT_PUBLIC_APP_URL, process.env.APP_URL].filter(Boolean) as string[];
  for (const rawUrl of appUrls) {
    try {
      const u = new URL(rawUrl);
      if (u.hostname) {
        if (process.env.NODE_ENV === 'production' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
          // Exclude localhost/loopback in production
        } else {
          allowedHosts.add(u.hostname);
        }
      }
    } catch { }
  }

  // Support optional owner-configured remote image hosts via IMAGE_REMOTE_HOSTS (empty by default)
  const remoteHostsEnv = process.env.IMAGE_REMOTE_HOSTS || '';
  if (remoteHostsEnv.trim()) {
    remoteHostsEnv
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
      .forEach((h) => {
        try {
          const u = h.includes('://') ? new URL(h) : new URL(`https://${h}`);
          if (u.hostname) allowedHosts.add(u.hostname);
        } catch {
          allowedHosts.add(h);
        }
      });
  }

  const patterns: NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> = [];
  for (const hostname of allowedHosts) {
    patterns.push({
      protocol: 'https',
      hostname,
    });
    patterns.push({
      protocol: 'http',
      hostname,
    });
  }

  return patterns;
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    cpus: 2,
  },
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [384, 640, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    remotePatterns: getImageRemotePatterns(),
  },
  turbopack: {},
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    // Step 14 Phase 2: Enforce strict CSP with escape switch DISABLE_STRICT_CSP=true
    const isCspDisabled = (process.env.DISABLE_STRICT_CSP || '').toLowerCase().trim() === 'true';
    const isCspEnforce = !isCspDisabled && ((process.env.CSP_ENFORCE || '').toLowerCase().trim() === 'true' || isProd);
    const cspKey = isCspEnforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https:",
      "media-src 'self' data: blob: https:",
      "frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "report-uri /api/csp-report",
    ].join('; ');

    const globalHeaders: Array<{ key: string; value: string }> = [
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      },
      {
        key: 'Cross-Origin-Opener-Policy',
        value: 'same-origin-allow-popups',
      },
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: cspKey,
        value: cspDirectives,
      },
    ];

    // Task S12b: Strict-Transport-Security: max-age=31536000 only in production
    if (isProd) {
      globalHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000',
      });
    }

    return [
      {
        source: '/:path*',
        headers: globalHeaders,
      },
      {
        // Task S12b: Cache-Control: no-store on /admin/:path*
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
      {
        // Task S12b: Cache-Control: no-store on /api/:path*
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/admin/promotions',
        destination: '/admin/promo-codes',
        permanent: false,
      },
      {
        source: '/admin/admins',
        destination: '/admin/staff',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/favicon.ico',
          destination: '/api/favicon',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
