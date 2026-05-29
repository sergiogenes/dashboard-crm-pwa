'use server'

import { getServerSession } from 'next-auth/next'
import { authOptions, signMfaToken } from '@/lib/auth'
import dbConnect from '@/lib/mongodb'
import User from '@/models/User'
import { generateSecret, generateURI, verify } from 'otplib'
import QRCode from 'qrcode'
import crypto from 'crypto'

/**
 * Genera un nuevo secreto MFA y su respectivo código QR en base64 para la configuración inicial.
 * Solo accesible para usuarios autenticados en su sesión de NextAuth.
 */
export async function generateMfaSetup() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return { success: false, error: 'No autorizado' }
    }

    const userId = session.user.id
    await dbConnect()

    const user = await User.findById(userId)
    if (!user) {
      return { success: false, error: 'Usuario no encontrado' }
    }

    if (user.twoFactorEnabled) {
      return { success: false, error: 'El doble factor de autenticación ya está configurado' }
    }

    // Generar secreto único con otplib v13
    const secret = generateSecret()
    // Generar la URI del autenticador con otplib v13
    const otpauth = generateURI({ secret, label: user.email, issuer: 'DashboardCRM' })
    // Generar código QR en formato data URL (base64) mediante qrcode
    const qrCodeUrl = await QRCode.toDataURL(otpauth)

    return {
      success: true,
      secret,
      qrCodeUrl,
    }
  } catch (error: any) {
    console.error('[MFA Actions] generateMfaSetup error:', error)
    return { success: false, error: 'Error al generar la configuración de MFA' }
  }
}

/**
 * Activa de forma definitiva el MFA para el usuario tras validar el primer código de confirmación.
 * Retorna los Backup Codes limpios para descarga y guarda los hashes en la base de datos.
 */
export async function enableMFA(secret: string, code: string) {
  try {
    if (!secret || !code) {
      return { success: false, error: 'Parámetros inválidos' }
    }

    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return { success: false, error: 'No autorizado' }
    }

    const userId = session.user.id
    await dbConnect()

    const user = await User.findById(userId)
    if (!user) {
      return { success: false, error: 'Usuario no encontrado' }
    }

    if (user.twoFactorEnabled) {
      return { success: false, error: 'El MFA ya se encuentra habilitado' }
    }

    // Verificar el código de 6 dígitos ingresado contra la clave secreta provista (función async en otplib v13)
    const isValid = await verify({ token: code, secret })
    if (!isValid) {
      return { success: false, error: 'El código ingresado es incorrecto' }
    }

    // Generar 8 Backup Codes (Códigos de recuperación) únicos
    const { plain: backupCodesPlain, hashed: backupCodesHashed } = generateBackupCodes()

    // Guardar el secreto y los hashes en MongoDB
    user.twoFactorSecret = secret
    user.twoFactorBackupCodes = backupCodesHashed
    user.twoFactorEnabled = true
    await user.save()

    // Firmar token de paso para actualizar la sesión de NextAuth a mfaVerified
    const mfaToken = signMfaToken(userId)

    return {
      success: true,
      backupCodes: backupCodesPlain,
      mfaToken,
    }
  } catch (error: any) {
    console.error('[MFA Actions] enableMFA error:', error)
    return { success: false, error: 'Error al habilitar el MFA' }
  }
}

/**
 * Verifica el código de acceso (TOTP de 6 dígitos o Backup Code de 10 caracteres).
 * Si es válido, emite un token firmado para finalizar el inicio de sesión.
 */
export async function verifyMFA(code: string) {
  try {
    if (!code) {
      return { success: false, error: 'Código requerido' }
    }

    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return { success: false, error: 'No autorizado' }
    }

    const userId = session.user.id
    await dbConnect()

    const user = await User.findById(userId)
    if (!user) {
      return { success: false, error: 'Usuario no encontrado' }
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return { success: false, error: 'El MFA no está configurado en tu cuenta' }
    }

    const cleanCode = code.trim().toUpperCase()

    // 1. Intentar validar como código TOTP (6 dígitos numéricos - función async en otplib v13)
    if (/^\d{6}$/.test(cleanCode)) {
      const isValid = await verify({
        token: cleanCode,
        secret: user.twoFactorSecret,
      })

      if (isValid) {
        const mfaToken = signMfaToken(userId)
        return { success: true, mfaToken }
      }
    }

    // 2. Intentar validar como Backup Code de 10 caracteres
    if (/^[0-9A-F]{10}$/.test(cleanCode)) {
      const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex')
      const codeIndex = user.twoFactorBackupCodes.indexOf(codeHash)

      if (codeIndex !== -1) {
        // Eliminar (quemar) el Backup Code utilizado
        user.twoFactorBackupCodes.splice(codeIndex, 1)
        await user.save()

        const mfaToken = signMfaToken(userId)
        return { success: true, mfaToken }
      }
    }

    return { success: false, error: 'El código de seguridad ingresado es incorrecto o ya fue utilizado' }
  } catch (error: any) {
    console.error('[MFA Actions] verifyMFA error:', error)
    return { success: false, error: 'Error al verificar el MFA' }
  }
}

/**
 * Restablece el MFA de cualquier usuario. Solo accesible para administradores del sistema.
 */
export async function adminResetMFA(targetUserId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return { success: false, error: 'No autorizado' }
    }

    await dbConnect()

    // Verificar si el usuario solicitante es un administrador
    const currentUser = await User.findById(session.user.id)
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Acceso denegado. Se requieren permisos de administrador.' }
    }

    const targetUser = await User.findById(targetUserId)
    if (!targetUser) {
      return { success: false, error: 'Usuario destino no encontrado' }
    }

    targetUser.twoFactorEnabled = false
    targetUser.twoFactorSecret = undefined
    targetUser.twoFactorBackupCodes = []
    await targetUser.save()

    return { success: true }
  } catch (error: any) {
    console.error('[MFA Actions] adminResetMFA error:', error)
    return { success: false, error: 'Error al restablecer el MFA del usuario' }
  }
}

/**
 * Función auxiliar para generar 8 códigos de recuperación alfanuméricos de 10 caracteres legibles.
 */
function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = []
  const hashed: string[] = []
  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase()
    plain.push(code)
    const hash = crypto.createHash('sha256').update(code).digest('hex')
    hashed.push(hash)
  }
  return { plain, hashed }
}
