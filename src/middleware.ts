import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Si el usuario está autenticado pero tiene el MFA pendiente de validar
    if (token && token.mfaRequired && !token.mfaVerified) {
      if (token.twoFactorEnabled) {
        if (path !== '/auth/mfa') {
          return NextResponse.redirect(new URL('/auth/mfa', req.url))
        }
      } else {
        if (path !== '/auth/mfa-setup') {
          return NextResponse.redirect(new URL('/auth/mfa-setup', req.url))
        }
      }
    }

    // Si ya completó la autenticación MFA pero intenta entrar a los flujos de MFA, redirigir al inicio
    if (token && token.mfaVerified && (path === '/auth/mfa' || path === '/auth/mfa-setup')) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
)


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
     * - _next (archivos de compilación y HMR de Next.js)
     * - manifest.json, sw.js, workbox-*.js, fallback-*.js (PWA y archivos estáticos)
     * - favicon.ico, favicon.png, apple-touch-icon.png, icon-*.png, vercel.svg, next.svg (iconos y logos)
     */
    '/((?!api/auth|api/webhooks/.*|api/health|auth/signin|auth/forgot-password|auth/reset-password|_next|manifest.json|sw.js|workbox-|fallback-|icon-|apple-touch-icon.png|favicon.png|favicon.ico|vercel.svg|next.svg).*)',
  ],
}
