import withPWA from 'next-pwa'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self';",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline';",
              "style-src 'self' 'unsafe-inline';",
              "img-src 'self' data: blob:;",
              "connect-src 'self' ws: wss:;",
              "frame-ancestors 'none';",
              "form-action 'self';",
            ].join(' '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
  additionalManifestEntries: [
    { url: '/~offline', revision: Date.now().toString() }
  ],
  fallbacks: {
    document: '/~offline', 
  },
  runtimeCaching: [
    {
      urlPattern: /\/api\/auth\/(signin|signout|callback|signup).*/,
      handler: 'NetworkOnly',
      options: {
        cacheName: 'auth-api-critical',
      }
    },
    {
      urlPattern: /\/api\/auth\/session/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'auth-session',
        networkTimeoutSeconds: 2,
        expiration: {
          maxEntries: 1,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 semana
        },
      },
    },
    {
      urlPattern: /\/(auth\/signin|~offline|(\?.*)?$)/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$|.*_rsc=.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
})

export default pwaConfig(nextConfig)
