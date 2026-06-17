import { NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Lead from '@/models/Lead'
import Activity from '@/models/Activity'

interface InfobipIncomingMessage {
  messageId: string
  from: string // Teléfono del cliente
  to: string // Nuestro número de WhatsApp
  channel?: string
  receivedAt: string
  message: {
    type: string
    text: string
  }
  contact?: {
    name?: string
  }
}

interface InfobipWebhookPayload {
  results?: InfobipIncomingMessage[]
}

/**
 * POST /api/webhooks/whatsapp
 * Receptor de mensajes entrantes (Inbound) de WhatsApp desde Infobip.
 * Guarda las respuestas del cliente en MongoDB para que se sincronicen con el Dashboard local.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.json() as InfobipWebhookPayload
    console.log('[Webhook WhatsApp] Recibido payload de Infobip:', JSON.stringify(rawBody))

    if (!rawBody.results || rawBody.results.length === 0) {
      return NextResponse.json({ ok: true, message: 'No results found' }, { status: 200 })
    }

    await dbConnect()

    for (const result of rawBody.results) {
      const { from, message, messageId, receivedAt } = result

      if (!from || !message || message.type !== 'TEXT') {
        console.log(`[Webhook WhatsApp] Saltando mensaje ${messageId}: no es de texto o no tiene remitente`)
        continue
      }

      const cleanIncomingPhone = from.replace(/\D/g, '')

      // 1. Buscar el contacto en MongoDB de forma resiliente por teléfono
      const leads = await Lead.find({ deleted: false })
      const lead = leads.find((l) => {
        if (!l.phone) return false
        const cleanLeadPhone = l.phone.replace(/\D/g, '')
        // Comprobar coincidencia flexible por sufijo (ej: maneja códigos de país ausentes u omitidos)
        return cleanLeadPhone.endsWith(cleanIncomingPhone) || cleanIncomingPhone.endsWith(cleanLeadPhone)
      })

      if (!lead) {
        console.warn(`[Webhook WhatsApp] No se encontró ningún lead asociado al teléfono: ${from}`)
        continue
      }

      // 2. Comprobar si el mensaje ya fue registrado previamente usando el tempId
      const tempId = `whatsapp_${messageId}`
      const messageExists = await Activity.exists({ tempId })
      if (messageExists) {
        console.log(`[Webhook WhatsApp] El mensaje ${messageId} ya está registrado. Saltando.`)
        continue
      }

      // 3. Registrar el mensaje en la colección de Actividades de MongoDB
      const newActivity = new Activity({
        tempId,
        leadId: lead._id,
        userId: lead.userId,
        type: 'WHATSAPP',
        title: 'WhatsApp Recibido',
        body: message.text,
        timestamp: new Date(receivedAt),
        crmSynced: false, // Permitir que el motor lo suba a HubSpot para registrar la respuesta del cliente
        deleted: false,
      })

      await newActivity.save()
      console.log(`[Webhook WhatsApp] Registrada respuesta de WhatsApp para el lead ${lead.firstName} ${lead.lastName} (LeadID: ${lead._id})`)
    }

    // Retornar 200 OK inmediatamente para que Infobip no reintente el envío
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error: any) {
    console.error('[Webhook WhatsApp] Error al procesar webhook de mensajería:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
