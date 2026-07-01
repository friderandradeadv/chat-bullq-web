import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/settings',
        destination: '/settings/general',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
