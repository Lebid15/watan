import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // يتجاهل أخطاء ESLint أثناء البناء
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

export default nextConfig;
