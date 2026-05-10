/** @type {import('next').NextConfig} */
const backendBase = process.env.BACKEND_URL || 'http://localhost:3002';

// Rewrites proxy /api through Next.js and buffer the body (default ~10MB). Point-cloud
// chunk uploads use 32MB parts (backend `upload/pointcloud/chunk`); raise the proxy
// limit or chunks are silently truncated and assembly/conversion breaks.
/** @type {string} */
const PROXY_BODY_MAX =
  process.env.NEXT_PROXY_MAX_BODY ?? '128mb';

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    proxyClientMaxBodySize: PROXY_BODY_MAX,
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '3002', pathname: '/**' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;