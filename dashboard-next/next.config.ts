import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  devIndicators: false,
  // Silence the multiple-lockfiles warning — root is the monorepo root
  outputFileTracingRoot: path.join(__dirname, '../'),
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
