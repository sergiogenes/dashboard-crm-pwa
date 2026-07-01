import { NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Lead from '@/models/Lead'
import Activity from '@/models/Activity'
import { MessagingProviderFactory } from '@/lib/messaging/factory'

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const provider = MessagingProviderFactory.getProvider()
    const incomingMessages = await provider.parseWebhook(req, rawBody)

    if (incomingMessages.length === 0) {
      return NextResponse.json({ ok: true, message: 'No messages processed' }, { status: 200 })
    }

    await dbConnect()

    for (const msg of incomingMessages) {
      const { fromPhone, body, messageId, timestamp } = msg
      const cleanIncomingPhone = fromPhone.replace(/\D/g, '')

      // 1. Buscar el contacto en MongoDB de forma resiliente por teléfono
      const leads = await Lead.find({ deleted: false })
      const lead = leads.find((l) => {
        if (!l.phone) return false
        const cleanLeadPhone = l.phone.replace(/\D/g, '')
        // Comprobar coincidencia flexible por sufijo (ej: maneja códigos de país ausentes u omitidos)
        return cleanLeadPhone.endsWith(cleanIncomingPhone) || cleanIncomingPhone.endsWith(cleanLeadPhone)
      })

      if (!lead) {
        console.warn(`[Webhook WhatsApp] No se encontró ningún lead asociado al teléfono: ${fromPhone}`)
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
        body,
        timestamp,
        crmSynced: false, // Permitir que el motor lo suba a HubSpot para registrar la respuesta del cliente
        deleted: false,
      })

      await newActivity.save()
      console.log(`[Webhook WhatsApp] Registrada respuesta de WhatsApp para el lead ${lead.firstName} ${lead.lastName} (LeadID: ${lead._id})`)
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error: any) {
    console.error('[Webhook WhatsApp] Error al procesar webhook de mensajería:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
