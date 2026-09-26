import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      }
    ],
  },
  async redirects() {
    return [
      {
        source: '/admin/promotions',
        destination: '/admin/promo-codes',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
