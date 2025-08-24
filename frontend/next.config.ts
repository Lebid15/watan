import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // يتجاهل أخطاء ESLint أثناء البناء
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
