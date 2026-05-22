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
    ]
  },
}

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
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
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'auth-session',
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
