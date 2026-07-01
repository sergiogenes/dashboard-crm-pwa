import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'

// Obtiene la clave de 32 bytes derivada del secreto del servidor
const getSecretKey = (): Buffer => {
  const secret = process.env.SERVER_ENCRYPTION_SECRET || 'default-server-encryption-secret-32bytes-long-2026'
  return crypto.createHash('sha256').update(secret).digest()
}

export function encrypt(text: string): string {
  if (!text) return text
  // Evitar encriptar algo que ya tiene el prefijo de IV
  if (text.includes(':') && text.split(':')[0].length === 32) return text

  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ciphertext
  try {
    const parts = ciphertext.split(':')
    // Validar formato "iv_hex:ciphertext_hex"
    if (parts.length !== 2 || parts[0].length !== 32) return ciphertext

    const iv = Buffer.from(parts[0], 'hex')
    const encryptedText = Buffer.from(parts[1], 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString('utf8')
  } catch (error) {
    console.error('[Crypto] Decryption failed:', error)
    return ciphertext // Retornar el valor original en caso de error
  }
}

export function hash(text: string): string {
  if (!text) return ''
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex')
}
