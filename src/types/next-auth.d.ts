import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  /** Extendemos el tipo de sesión para incluir el id del usuario */
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }

  interface User {
    id: string
  }
}

declare module 'next-auth/jwt' {
  /** Extendemos el JWT para incluir el id del usuario */
  interface JWT {
    id: string
  }
}
