import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // يتجاهل أخطاء ESLint أثناء البناء
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Keep trailing slashes so Django's APPEND_SLASH redirects do not loop with Next
  trailingSlash: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api-dj/:path*',
        destination: 'http://127.0.0.1:8000/api-dj/:path*',
      },
    ];
  },
  async headers() {
    // Optionally inject a fixed X-Tenant-Host header only if explicitly configured.
    // Otherwise rely on client-side headers (axios/fetch) which use the actual host/cookie.
    const tenantHost = process.env.NEXT_PUBLIC_TENANT_HOST;
    if (tenantHost) {
      return [
        {
          source: '/api-dj/:path*',
          headers: [
            { key: 'X-Tenant-Host', value: tenantHost },
          ],
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
