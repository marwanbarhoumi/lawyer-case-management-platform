import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/**
 * Two ways to reach the API:
 * - API_PROXY_TARGET (recommended on Vercel): the browser calls `/api/*` on the app's own origin and
 *   Next/Vercel proxies it to the backend, so the refresh cookie is first-party.
 * - NEXT_PUBLIC_API_URL: the browser calls the API origin directly (CORS + cross-site cookie).
 */
const proxyTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/$/, '') || undefined;

if (proxyTarget && !/^https?:\/\/[^/]+$/.test(proxyTarget)) {
  throw new Error(
    'API_PROXY_TARGET must be an origin such as https://my-api.onrender.com (no path).',
  );
}

const apiUrl = proxyTarget
  ? ''
  : (process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:5000'));

if (apiUrl === undefined) {
  throw new Error(
    'Set API_PROXY_TARGET (same-origin proxy) or NEXT_PUBLIC_API_URL for production builds.',
  );
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" +
        (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self'${apiUrl ? ` ${apiUrl}` : ''}`,
      "frame-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  env: { NEXT_PUBLIC_API_URL: apiUrl },
  async headers() {
    const routes = [{ source: '/:path*', headers: securityHeaders }];
    if (proxyTarget) {
      // Per-user API responses must never be cached by the Vercel CDN.
      routes.push({
        source: '/api/:path*',
        headers: [{ key: 'x-vercel-enable-rewrite-caching', value: '0' }],
      });
    }
    return routes;
  },
  async rewrites() {
    return proxyTarget ? [{ source: '/api/:path*', destination: `${proxyTarget}/api/:path*` }] : [];
  },
};

export default withNextIntl(nextConfig);
