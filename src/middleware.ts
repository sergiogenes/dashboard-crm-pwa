import { withAuth } from 'next-auth/middleware'

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: '/auth/signin',
  },
})

// Configura las rutas protegidas. 
// Protege el root y cualquier subruta, excepto api/auth, api/webhooks, api/health, e imágenes/manifest/sw.
export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas excepto las siguientes:
     * - api/auth (NextAuth)
     * - api/webhooks/crm (HubSpot webhooks)
     * - api/health (Salud del servidor)
     * - auth/signin (Página de login)
     * - _next/static (archivos estáticos de Next.js)
     * - _next/image (optimización de imágenes)
     * - manifest.json, sw.js, workbox-*.js, fallback-*.js (PWA y archivos estáticos)
     * - favicon.ico, favicon.png, apple-touch-icon.png, icon-*.png, vercel.svg, next.svg (iconos y logos)
     */
    '/((?!api/auth|api/webhooks/crm|api/health|auth/signin|_next/static|_next/image|manifest.json|sw.js|workbox-|fallback-|icon-|apple-touch-icon.png|favicon.png|favicon.ico|vercel.svg|next.svg).*)',
  ],
}
