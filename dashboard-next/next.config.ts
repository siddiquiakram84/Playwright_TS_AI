import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  devIndicators: false,
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
