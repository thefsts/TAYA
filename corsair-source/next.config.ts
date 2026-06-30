import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  compress: true,

  async redirects() {
    return [
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },
      // Removed duplicate course — 301 redirect preserves SEO
      { source: '/courses/texas-license-to-carry', destination: '/courses/texas-ltc-certification-basic-handgun', permanent: true },
      { source: '/:locale/courses/texas-license-to-carry', destination: '/:locale/courses/texas-ltc-certification-basic-handgun', permanent: true },
    ];
  },

  images: {
    // Serve AVIF first (30-50% smaller than WebP), then WebP fallback
    formats: ['image/avif', 'image/webp'],

    // Cache optimised images for 30 days instead of the default 60 seconds.
    // This is the single biggest speed-up for repeat visitors on Vercel.
    minimumCacheTTL: 2592000,

    // Standard responsive breakpoints
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
