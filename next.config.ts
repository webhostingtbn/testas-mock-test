import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure secure headers are set for authentication
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
