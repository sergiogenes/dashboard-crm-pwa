import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      mfaRequired?: boolean
      mfaVerified?: boolean
      twoFactorEnabled?: boolean
    } & DefaultSession['user']
  }

  interface User {
    id: string
    mfaRequired?: boolean
    mfaVerified?: boolean
    twoFactorEnabled?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    mfaRequired?: boolean
    mfaVerified?: boolean
    twoFactorEnabled?: boolean
  }
}
