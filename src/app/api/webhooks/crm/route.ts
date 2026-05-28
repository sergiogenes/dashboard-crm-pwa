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
    const signatureV3 = req.headers.get('x-hubspot-signature-v3')
    const timestamp = req.headers.get('x-hubspot-request-timestamp')

    if (clientSecret) {
      if (!signature && !signatureV3) {
        console.error('[Webhook CRM] Error: Falta cabecera de firma de HubSpot')
        return NextResponse.json({ error: 'Faltan cabeceras de firma' }, { status: 401 })
      }

      // Reconstruir la URL absoluta
      const method = req.method
      const urlObj = new URL(req.url)
      const proto = req.headers.get('x-forwarded-proto') || 'https'
      const host = req.headers.get('host') || urlObj.host
      const uri = `${proto}://${host}${urlObj.pathname}${urlObj.search}`

      let v3Valid = false
      let v2Valid = false
      let v1Valid = false

      // --- VALIDACIÓN V3 (Recomendada por HubSpot) ---
      if (signatureV3 && timestamp) {
        // La firma v3 de HubSpot es HMAC-SHA256 en Base64
        const sourceStringV3 = method + uri + rawBody + timestamp
        const expectedSignatureV3 = crypto
          .createHmac('sha256', clientSecret)
          .update(sourceStringV3)
          .digest('base64')

        v3Valid = (signatureV3 === expectedSignatureV3)
        console.log('[Webhook CRM] Diagnóstico V3:', {
          signatureV3,
          expectedSignatureV3,
          v3Valid
        })
      }

      // --- VALIDACIÓN V2 (SHA-256) ---
      if (signature) {
        const sourceStringV2 = clientSecret + method + uri + rawBody
        const expectedSignatureV2 = crypto.createHash('sha256').update(sourceStringV2).digest('hex')
        v2Valid = (signature === expectedSignatureV2)

        // Fallback V1 (MD5)
        const sourceStringV1 = clientSecret + rawBody
        const expectedSignatureV1 = crypto.createHash('md5').update(sourceStringV1).digest('hex')
        v1Valid = (signature === expectedSignatureV1)

        console.log('[Webhook CRM] Diagnóstico V2/V1:', {
          signature,
          expectedSignatureV2,
          v2Valid,
          expectedSignatureV1,
          v1Valid
        })
      }

      // Validar si al menos un método es exitoso
      if (!v3Valid && !v2Valid && !v1Valid) {
        console.error('[Webhook CRM] Error: Todas las firmas de HubSpot fallaron la validación.')
        return NextResponse.json({ error: 'Firma de webhook inválida' }, { status: 401 })
      }

      console.log('[Webhook CRM] Firma validada exitosamente mediante:', {
        v3: v3Valid,
        v2: v2Valid,
        v1: v1Valid
      })
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

        if (lead && lead.deleted) {
          console.log(`[Webhook CRM] Ignorando evento para lead crmId ${crmId} marcado como eliminado.`)
          continue
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

        if (company && company.deleted) {
          console.log(`[Webhook CRM] Ignorando evento para empresa crmId ${crmId} marcada como eliminada.`)
          continue
        }

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
