import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Por favor define la variable de entorno MONGODB_URI dentro de .env.local')
}

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
let cached: MongooseGlobalConnection = globalThis.mongooseConnection || { conn: null, promise: null }

if (!globalThis.mongooseConnection) {
  globalThis.mongooseConnection = cached
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    }

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
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
