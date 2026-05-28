import { NextResponse } from 'next/server'
import crypto from 'crypto'
import dbConnect from '@/lib/mongodb'
import Lead from '@/models/Lead'
import Company from '@/models/Company'
import User from '@/models/User'

interface HubSpotWebhookEvent {
  eventId: number
  subscriptionId: number
  portalId: number
  occurredAt: number
  subscriptionType: string
  attemptNumber: number
  objectId: number
  propertyName?: string
  propertyValue?: string
  fromObjectId?: number
  toObjectId?: number
  associationType?: string
}

/**
 * POST /api/webhooks/crm
 * Receptor de webhooks de HubSpot para sincronización entrante (Inbound Sync).
 * Maneja eventos en lote de Contactos, Empresas y Asociaciones.
 * Realiza verificación de firma utilizando HUBSPOT_CLIENT_SECRET si está presente.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text()

    // 1. Validación de Firma de HubSpot (Opcional en desarrollo)
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET
    const signature = req.headers.get('x-hubspot-signature')

    if (clientSecret) {
      if (!signature) {
        return NextResponse.json({ error: 'Falta cabecera x-hubspot-signature' }, { status: 401 })
      }

      // Validar Firma HubSpot v2
      const method = req.method
      const urlObj = new URL(req.url)
      const proto = req.headers.get('x-forwarded-proto') || 'https'
      const host = req.headers.get('host') || urlObj.host
      const uri = `${proto}://${host}${urlObj.pathname}${urlObj.search}`

      const sourceString = clientSecret + method + uri + rawBody
      const expectedSignature = crypto.createHash('sha256').update(sourceString).digest('hex')

      if (signature !== expectedSignature) {
        // Fallback a Firma v1 por compatibilidad
        const sourceStringV1 = clientSecret + rawBody
        const expectedSignatureV1 = crypto.createHash('md5').update(sourceStringV1).digest('hex')

        if (signature !== expectedSignatureV1) {
          return NextResponse.json({ error: 'Firma de webhook inválida' }, { status: 401 })
        }
      }
    } else {
      console.warn('[Webhook CRM] Advertencia: HUBSPOT_CLIENT_SECRET no configurado. Procesando webhook sin verificar firma.')
    }

    await dbConnect()

    const events: HubSpotWebhookEvent[] = JSON.parse(rawBody)

    // Obtener un usuario de respaldo por si el contacto se creó primero en el CRM y no tiene userId
    const defaultUserDoc = await User.findOne()
    const defaultUserId = defaultUserDoc ? String(defaultUserDoc._id) : 'system_fallback'

    for (const event of events) {
      const { subscriptionType, objectId } = event
      const crmId = String(objectId)

      if (subscriptionType.startsWith('contact.')) {
        // --- FLUJO DE LEADS (CONTACTOS) ---
        if (subscriptionType === 'contact.deletion') {
          await Lead.deleteOne({ crmId })
          console.log(`[Webhook CRM] Lead crmId ${crmId} eliminado por acción en CRM.`)
          continue
        }

        let lead = await Lead.findOne({ crmId })

        if (!lead && event.propertyName === 'email' && event.propertyValue) {
          // Intentar emparejar con lead local existente por email
          lead = await Lead.findOne({ email: event.propertyValue })
        }

        if (!lead) {
          lead = new Lead({
            crmId,
            firstName: '',
            lastName: '',
            email: event.propertyName === 'email' ? event.propertyValue || '' : '',
            userId: defaultUserId,
            crmSynced: true,
            crmLastSyncAt: new Date(),
          })
        }

        // Aplicar propiedades cambiadas
        if (event.propertyName && event.propertyValue !== undefined) {
          switch (event.propertyName) {
            case 'firstname':
              lead.firstName = event.propertyValue
              break
            case 'lastname':
              lead.lastName = event.propertyValue
              break
            case 'email':
              lead.email = event.propertyValue
              break
            case 'phone':
              lead.phone = event.propertyValue
              break
          }
        }

        lead.crmSynced = true
        lead.crmLastSyncAt = new Date()
        await lead.save()
        console.log(`[Webhook CRM] Lead crmId ${crmId} guardado/actualizado.`)

      } else if (subscriptionType.startsWith('company.')) {
        // --- FLUJO DE EMPRESAS ---
        if (subscriptionType === 'company.deletion') {
          await Company.deleteOne({ crmId })
          console.log(`[Webhook CRM] Empresa crmId ${crmId} eliminada por acción en CRM.`)
          continue
        }

        let company = await Company.findOne({ crmId })

        if (!company) {
          company = new Company({
            crmId,
            name: event.propertyName === 'name' ? event.propertyValue || 'Nueva Empresa' : 'Nueva Empresa',
            userId: defaultUserId,
            crmSynced: true,
            crmLastSyncAt: new Date(),
          })
        }

        if (event.propertyName && event.propertyValue !== undefined) {
          switch (event.propertyName) {
            case 'name':
              company.name = event.propertyValue
              break
            case 'domain':
              company.domain = event.propertyValue
              break
          }
        }

        company.crmSynced = true
        company.crmLastSyncAt = new Date()
        await company.save()
        console.log(`[Webhook CRM] Empresa crmId ${crmId} guardada/actualizada.`)

      } else if (subscriptionType === 'association.creation') {
        // --- FLUJO DE ASOCIACIONES ---
        const fromId = String(event.fromObjectId)
        const toId = String(event.toObjectId)

        const lead = await Lead.findOne({ crmId: fromId })
        const company = await Company.findOne({ crmId: toId })

        if (lead && company) {
          lead.companyId = company._id as any
          lead.crmSynced = true
          await lead.save()
          console.log(`[Webhook CRM] Lead ${fromId} asociado a empresa ${toId} en MongoDB.`)
        }

      } else if (subscriptionType === 'association.deletion') {
        const fromId = String(event.fromObjectId)
        const lead = await Lead.findOne({ crmId: fromId })

        if (lead) {
          lead.companyId = null
          lead.crmSynced = true
          await lead.save()
          console.log(`[Webhook CRM] Asociación removida del lead ${fromId} en MongoDB.`)
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error: any) {
    console.error('[Webhook CRM] Error en procesamiento de webhook:', error)
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 })
  }
}
