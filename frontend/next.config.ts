import type { NextConfig } from "next";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*', // Proxy to your backend
      },
    ]
  },
};

export default nextConfig;
