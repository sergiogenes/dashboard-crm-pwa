import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import dbConnect from './mongodb'
import User from '@/models/User'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

/**
 * Genera un token firmado de un solo uso para indicar la verificación exitosa de MFA.
 */
export function signMfaToken(userId: string): string {
  const payload = JSON.stringify({
    userId,
    verified: true,
    exp: Date.now() + 60000,
  }) // 1 minuto de validez
  const base64Payload = Buffer.from(payload).toString('base64url')
  const signature = crypto
    .createHmac(
      'sha256',
      process.env.JWT_MFA_SECRET || 'default-fallback-secret-mfa-2026',
    )
    .update(base64Payload)
    .digest('base64url')
  return `${base64Payload}.${signature}`
}

/**
 * Verifica la firma y expiración del token de validación MFA.
 */
function verifyMfaToken(token: string, expectedUserId: string): boolean {
  try {
    const [base64Payload, signature] = token.split('.')
    if (!base64Payload || !signature) return false

    const expectedSignature = crypto
      .createHmac(
        'sha256',
        process.env.JWT_MFA_SECRET || 'default-fallback-secret-mfa-2026',
      )
      .update(base64Payload)
      .digest('base64url')

    if (signature !== expectedSignature) return false

    const payload = JSON.parse(
      Buffer.from(base64Payload, 'base64url').toString('utf8'),
    )
    if (
      payload.userId !== expectedUserId ||
      !payload.verified ||
      Date.now() > payload.exp
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error(
            'El correo electrónico o la contraseña son incorrectos',
          )
        }

        await dbConnect()
        const user = await User.findOne({
          email: credentials.email.toLowerCase(),
        })

        if (!user) {
          throw new Error(
            'El correo electrónico o la contraseña son incorrectos',
          )
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        )

        if (!isValid) {
          throw new Error(
            'El correo electrónico o la contraseña son incorrectos',
          )
        }

        // Emitimos la sesión con mfaVerified en false inicialmente.
        // El middleware o la UI redirigirán según corresponda.
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          mfaRequired: true,
          mfaVerified: false,
          twoFactorEnabled: user.twoFactorEnabled === true,
          roles: user.roles || [user.role || 'user'],
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.mfaRequired = user.mfaRequired
        token.mfaVerified = user.mfaVerified
        token.twoFactorEnabled = user.twoFactorEnabled
        token.roles = user.roles || ['user']
      }

      // Si el cliente solicita actualizar la sesión (NextAuth Session Update)
      if (trigger === 'update' && session) {
        if (session.mfaToken) {
          const isTokenValid = verifyMfaToken(session.mfaToken, token.id)
          if (isTokenValid) {
            token.mfaVerified = true
            token.twoFactorEnabled = true // Si validó, ahora está habilitado
          }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.mfaRequired = token.mfaRequired
        session.user.mfaVerified = token.mfaVerified
        session.user.twoFactorEnabled = token.twoFactorEnabled
        session.user.roles = token.roles || ['user']
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
