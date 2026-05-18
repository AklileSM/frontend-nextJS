/** @type {import('next').NextConfig} */

// BACKEND_URL is resolved at build time AND read at runtime for SSR requests.
// In Docker: set as a build arg so it is baked into the route manifest.
// In local dev: set in .env.local or as a shell env var before `npm run dev`.
// Changing it requires a rebuild, `docker compose up -d --build frontend-next`.
const backendBase = process.env.BACKEND_URL || 'http://localhost:3002';

// The Next.js proxy buffers the full request body before forwarding it.
// Default limit is ~10 MB, which would silently truncate point-cloud chunks
// (backend `upload/pointcloud/chunk` accepts up to 32 MB per chunk).
// 128 MB gives headroom without being unreasonable for a construction platform.
// Override with NEXT_PROXY_MAX_BODY env var if you change the chunk size.
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
  async redirects() {
    return [
      // /app/projects/:slug/settings was the original route but it lives outside
      // the app shell layout. This redirect keeps old links working without
      // duplicating the page. Query params (e.g. ?tab=) are preserved automatically.
      {
        source: '/app/projects/:slug/settings',
        destination: '/projects/:slug/settings',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      // All /api/* requests from the browser are rewritten server-side to the
      // backend. The browser never sees the backend hostname, it always calls
      // the same origin as the frontend. This eliminates CORS entirely and lets
      // the backend use internal Docker DNS names (http://backend:3001).
      {
        source: '/api/:path*',
        destination: `${backendBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;