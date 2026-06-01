'use server'

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import dbConnect from '@/lib/mongodb'
import User from '@/models/User'
import PasswordResetToken from '@/models/PasswordResetToken'
import { sendPasswordResetEmail } from '@/lib/mail'

/**
 * Solicita el restablecimiento de contraseña para un usuario.
 * Genera un token de un solo uso y lo envía por correo electrónico (SendGrid).
 */
export async function requestPasswordReset(email: string) {
  try {
    if (!email) {
      return { success: false, error: 'El correo electrónico es requerido' }
    }

    await dbConnect()

    const normalizedEmail = email.toLowerCase().trim()
    const user = await User.findOne({ email: normalizedEmail })

    // Mitigación de enumeración de usuarios: devolvemos éxito incluso si no existe
    if (!user) {
      console.log(`[Password Reset] Solicitud para correo no registrado: ${normalizedEmail}`)
      return { success: true }
    }

    // Generar token aleatorio seguro
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    
    // Tiempo de expiración: 30 minutos
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    // Eliminar cualquier token previo que tenga este usuario para evitar acumulación
    await PasswordResetToken.deleteMany({ userId: user._id })

    // Guardar nuevo token en la base de datos
    const tokenRecord = new PasswordResetToken({
      userId: user._id,
      tokenHash,
      expiresAt,
    })
    await tokenRecord.save()

    // Crear el enlace de restablecimiento
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`

    // Enviar el correo
    await sendPasswordResetEmail(normalizedEmail, resetLink)

    return { success: true }
  } catch (error: any) {
    console.error('[Password Reset Action] Error:', error)
    return { success: false, error: 'Ocurrió un error al procesar tu solicitud' }
  }
}

/**
 * Restablece la contraseña de un usuario validando el token efímero recibido.
 */
export async function resetPassword(formData: {
  token: string
  email: string
  password: string
}) {
  try {
    const { token, email, password } = formData

    if (!token || !email || !password) {
      return { success: false, error: 'Todos los campos son requeridos' }
    }

    if (password.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' }
    }

    await dbConnect()

    const normalizedEmail = email.toLowerCase().trim()
    const user = await User.findOne({ email: normalizedEmail })

    if (!user) {
      return { success: false, error: 'Token o correo electrónico inválido' }
    }

    // Calcular el hash del token recibido para comparar con el de la base de datos (SHA-256)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Buscar el registro del token
    const tokenRecord = await PasswordResetToken.findOne({
      userId: user._id,
      tokenHash,
    })

    if (!tokenRecord) {
      return { success: false, error: 'El enlace de restablecimiento es inválido o ha expirado' }
    }

    // Validar expiración por código (adicional al índice TTL de MongoDB)
    if (new Date() > tokenRecord.expiresAt) {
      await PasswordResetToken.deleteOne({ _id: tokenRecord._id })
      return { success: false, error: 'El enlace de restablecimiento ha expirado' }
    }

    // Hashear la nueva contraseña con bcryptjs
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)

    // Actualizar contraseña del usuario
    user.passwordHash = passwordHash
    await user.save()

    // Eliminar el token de forma inmediata para evitar reutilizaciones
    await PasswordResetToken.deleteOne({ _id: tokenRecord._id })

    return { success: true }
  } catch (error: any) {
    console.error('[Reset Password Action] Error:', error)
    return { success: false, error: 'Ocurrió un error al restablecer tu contraseña' }
  }
}
