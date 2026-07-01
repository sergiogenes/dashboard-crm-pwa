'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import dbConnect from '@/lib/mongodb'
import Lead from '@/models/Lead'
import Activity from '@/models/Activity'
import { MessagingProviderFactory } from '@/lib/messaging/factory'

export interface SendWhatsAppResponse {
  success: boolean
  error?: string
  activity?: {
    id: string
    tempId: string
    leadId: string
    userId: string
    type: 'WHATSAPP'
    title: string
    body: string
    timestamp: number
    synced: boolean
  }
}

/**
 * Server Action para enviar un mensaje de WhatsApp a un Lead.
 * Envía el mensaje mediante el proveedor configurado e inserta la actividad en MongoDB.
 */
export async function sendWhatsAppMessage(
  leadId: string,
  body: string,
  options?: { templateName?: string; language?: string; placeholders?: string[] }
): Promise<SendWhatsAppResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return { success: false, error: 'No autorizado' }
    }

    const userId = session.user.id

    await dbConnect()

    const lead = await Lead.findById(leadId)
    if (!lead || lead.deleted) {
      return { success: false, error: 'Contacto no encontrado' }
    }

    if (!lead.phone) {
      return { success: false, error: 'El contacto no posee un número de teléfono registrado' }
    }

    // Enviar mensaje a través de la factoría de mensajería (Infobip o Mock según .env)
    const provider = MessagingProviderFactory.getProvider()
    const result = await provider.sendMessage(lead.phone, body, options)

    if (!result.success) {
      return { success: false, error: result.error || 'Fallo al despachar el mensaje con el proveedor' }
    }

    // Registrar la actividad localmente en MongoDB
    const tempId = `whatsapp_${result.messageId || Math.random().toString(36).substring(2, 9)}`
    
    const activity = new Activity({
      tempId,
      leadId: lead._id,
      userId,
      type: 'WHATSAPP',
      title: 'WhatsApp Enviado',
      body,
      timestamp: new Date(),
      crmSynced: false, // El motor saliente (sync-engine) lo subirá a HubSpot
      deleted: false,
    })

    await activity.save()

    return {
      success: true,
      activity: {
        id: String(activity._id),
        tempId,
        leadId: String(lead._id),
        userId,
        type: 'WHATSAPP',
        title: activity.title,
        body: activity.body,
        timestamp: activity.timestamp.getTime(),
        synced: false,
      }
    }
  } catch (err: any) {
    console.error('[sendWhatsAppMessage] Error general:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}

export async function getWhatsAppTemplates(): Promise<{
  success: boolean
  templates?: { name: string; label: string; language: string; text: string; placeholders: string[] }[]
  error?: string
}> {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return { success: false, error: 'No autorizado' }
    }

    const provider = MessagingProviderFactory.getProvider()
    if (typeof provider.getTemplates === 'function') {
      const templates = await provider.getTemplates()
      return { success: true, templates }
    }

    return { success: true, templates: [] }
  } catch (err: any) {
    console.error('[getWhatsAppTemplates] Error general:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}
