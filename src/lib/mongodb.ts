import mongoose from 'mongoose'

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.prod_MONGODB_URI ||
  process.env.prod_MONGODB_URI_URL

// Extensión segura del objeto global en Node.js para TypeScript
interface MongooseGlobalConnection {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseConnection: MongooseGlobalConnection | undefined
}

// Si no existe en el ámbito global, inicializamos el objeto
let cached: MongooseGlobalConnection = globalThis.mongooseConnection || {
  conn: null,
  promise: null,
}

if (!globalThis.mongooseConnection) {
  globalThis.mongooseConnection = cached
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn
  }

  if (!MONGODB_URI) {
    throw new Error(
      'Por favor define la variable de entorno MONGODB_URI, prod_MONGODB_URI o prod_MONGODB_URI_URL',
    )
  }

  if (!cached.promise) {
    const baseUri = MONGODB_URI.split('?')[0]
    const uriParts = baseUri.split('/')
    const dbNameFromUri = uriParts[3] || null

    const isPlaywrightTest = process.env.IS_PLAYWRIGHT_TEST === 'true'
    const finalDbName = isPlaywrightTest
      ? 'dashboard-pwa-test'
      : dbNameFromUri || 'dashboard-pwa'

    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000,
      dbName: finalDbName,
    }

    cached.promise = mongoose
      .connect(MONGODB_URI!, opts)
      .then((mongooseInstance) => {
        return mongooseInstance
      })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default dbConnect
