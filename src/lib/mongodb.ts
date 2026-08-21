import mongoose from 'mongoose'

// Extensión segura del objeto global en Node.js para TypeScript
interface MongooseGlobalConnection {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
  // Nombre de base de datos con el que se estableció `conn`/`promise`.
  // Se usa para detectar, en cada llamada, si el entorno derivó hacia
  // una base distinta a la que originalmente abrió la conexión cacheada.
  connectedDbName: string | null
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseConnection: MongooseGlobalConnection | undefined
}

// Si no existe en el ámbito global, inicializamos el objeto
let cached: MongooseGlobalConnection = globalThis.mongooseConnection || {
  conn: null,
  promise: null,
  connectedDbName: null,
}

if (!globalThis.mongooseConnection) {
  globalThis.mongooseConnection = cached
}

/**
 * Calcula el nombre de base de datos que le corresponde a este proceso
 * según el entorno actual. Se recalcula en cada llamada (no se cachea a
 * nivel de módulo) porque `IS_PLAYWRIGHT_TEST` puede variar entre llamadas
 * durante pruebas, y necesitamos poder detectar el drift, no solo leerlo una vez.
 */
function resolveExpectedDbName(mongoUri: string): string {
  const baseUri = mongoUri.split('?')[0]
  const uriParts = baseUri.split('/')
  const dbNameFromUri = uriParts[3] || null

  const isPlaywrightTest = process.env.IS_PLAYWRIGHT_TEST === 'true'
  return isPlaywrightTest ? 'dashboard-pwa-test' : dbNameFromUri || 'dashboard-pwa'
}

async function dbConnect(): Promise<typeof mongoose> {
  // Resolver la URI y el nombre de DB esperado en cada llamada (no a nivel de
  // módulo): así detectamos si el entorno cambió entre llamadas en vez de
  // fijar para siempre el primer valor leído al importar el módulo.
  const MONGODB_URI =
    process.env.MONGODB_URI ||
    process.env.prod_MONGODB_URI ||
    process.env.prod_MONGODB_URI_URL

  if (!MONGODB_URI) {
    throw new Error(
      'Por favor define la variable de entorno MONGODB_URI, prod_MONGODB_URI o prod_MONGODB_URI_URL',
    )
  }

  const expectedDbName = resolveExpectedDbName(MONGODB_URI)

  if (cached.conn) {
    // Guarda de seguridad: si la conexión cacheada (sobrevive HMR vía globalThis)
    // fue abierta para una base distinta a la que el entorno actual espera,
    // abortamos en vez de devolver silenciosamente la conexión equivocada.
    // Esto es exactamente lo que permitió que un proceso de desarrollo con la
    // base real siguiera sirviendo esa base aun cuando IS_PLAYWRIGHT_TEST
    // cambiara de valor a mitad de sesión por la fuga de `.env.local`.
    if (cached.connectedDbName && cached.connectedDbName !== expectedDbName) {
      throw new Error(
        `[dbConnect] Discrepancia de base de datos detectada: la conexión cacheada apunta a ` +
          `"${cached.connectedDbName}" pero el entorno actual (IS_PLAYWRIGHT_TEST="${process.env.IS_PLAYWRIGHT_TEST}") ` +
          `espera "${expectedDbName}". Abortando para evitar operar sobre la base incorrecta. ` +
          `Reiniciá el proceso para forzar una reconexión limpia.`,
      )
    }
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000,
      dbName: expectedDbName,
    }

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        cached.connectedDbName = expectedDbName
        return mongooseInstance
      })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    cached.connectedDbName = null
    throw e
  }

  return cached.conn
}

export default dbConnect
