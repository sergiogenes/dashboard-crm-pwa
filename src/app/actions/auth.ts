'use server'

import dbConnect from '@/lib/mongodb'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

/**
 * Server Action para registrar un nuevo usuario en MongoDB.
 * Cifra la contraseña con bcryptjs usando 10 rondas de salt.
 */
export async function registerUser(formData: {
  name: string
  email: string
  password: string
  crmOwnerId?: string
}) {
  try {
    const { name, email, password, crmOwnerId } = formData

    if (!email || !password) {
      return { success: false, error: 'El email y la contraseña son requeridos' }
    }

    await dbConnect()

    // Comprobar si el usuario ya existe
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return { success: false, error: 'El email ya está registrado' }
    }

    // Cifrar la contraseña
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)

    // Crear el usuario
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      passwordHash,
      crmOwnerId: crmOwnerId || undefined,
    })

    await newUser.save()

    return {
      success: true,
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        crmOwnerId: newUser.crmOwnerId,
      },
    }
  } catch (error: any) {
    console.error('[Register Server Action] Error:', error)
    return { success: false, error: error.message || 'Error interno al registrar el usuario' }
  }
}
