import { NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Lead from '@/models/Lead'
import Company from '@/models/Company'
import User from '@/models/User'
import Invoice from '@/models/Invoice'
import Deal from '@/models/Deal'
import { CRMProviderFactory } from '@/lib/crm/factory'
import { hash } from '@/lib/crypto'
import { syncDealsForLead } from '@/app/actions/sync'

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const crm = CRMProviderFactory.getProvider()

    const events = await crm.verifyAndParseWebhook(req, rawBody)
    if (events === null) {
      return NextResponse.json(
        { error: 'Firma de webhook inválida' },
        { status: 401 },
      )
    }

    await dbConnect()

    // Obtener un usuario de respaldo por si el contacto se creó primero en el CRM y no tiene userId
    const defaultUserDoc = await User.findOne()
    const defaultUserId = defaultUserDoc
      ? String(defaultUserDoc._id)
      : 'system_fallback'

    for (const event of events) {
      const { subscriptionType, crmId } = event

      if (subscriptionType === 'lead.deletion') {
        await Lead.deleteOne({ crmId })
        console.log(
          `[Webhook CRM] Lead crmId ${crmId} eliminado por acción en CRM.`,
        )
        continue
      }

      if (subscriptionType === 'lead.upsert') {
        let lead = await Lead.findOne({ crmId })

        if (!lead && event.propertyName === 'email' && event.propertyValue) {
          lead = await Lead.findOne({ emailHash: hash(event.propertyValue) })
        }

        if (lead && lead.deleted) {
          console.log(
            `[Webhook CRM] Ignorando evento para lead crmId ${crmId} marcado como eliminado.`,
          )
          continue
        }

        if (!lead) {
          lead = new Lead({
            crmId,
            firstName: '',
            lastName: '',
            email:
              event.propertyName === 'email' ? event.propertyValue || '' : '',
            userId: defaultUserId,
            crmSynced: true,
            crmLastSyncAt: new Date(),
          })
        }

        if (event.propertyName && event.propertyValue !== undefined) {
          switch (event.propertyName) {
            case 'firstName':
              lead.firstName = event.propertyValue
              break
            case 'lastName':
              lead.lastName = event.propertyValue
              break
            case 'email':
              lead.email = event.propertyValue
              break
            case 'phone':
              lead.phone = event.propertyValue
              break
            case 'documentId':
              lead.documentId = event.propertyValue
              break
          }
        }

        lead.crmSynced = true
        lead.crmLastSyncAt = new Date()
        await lead.save()
        console.log(`[Webhook CRM] Lead crmId ${crmId} guardado/actualizado.`)
      }

      if (subscriptionType === 'company.deletion') {
        await Company.deleteOne({ crmId })
        console.log(
          `[Webhook CRM] Empresa crmId ${crmId} eliminada por acción en CRM.`,
        )
        continue
      }

      if (subscriptionType === 'company.upsert') {
        let company = await Company.findOne({ crmId })

        if (company && company.deleted) {
          console.log(
            `[Webhook CRM] Ignorando evento para empresa crmId ${crmId} marcada como eliminada.`,
          )
          continue
        }

        if (!company) {
          company = new Company({
            crmId,
            name:
              event.propertyName === 'name'
                ? event.propertyValue || 'Nueva Empresa'
                : 'Nueva Empresa',
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
        console.log(
          `[Webhook CRM] Empresa crmId ${crmId} guardada/actualizada.`,
        )
      }

      if (subscriptionType === 'invoice.deletion') {
        const invToDelete = await Invoice.findOne({ crmId })
        if (invToDelete) {
          const leadId = invToDelete.leadId
          await Invoice.deleteOne({ crmId })
          console.log(`[Webhook CRM] Factura crmId ${crmId} eliminada.`)

          const lead = await Lead.findById(leadId)
          if (lead) {
            const leadInvoices = await Invoice.find({ leadId: lead._id })
            const hasOverdue = leadInvoices.some(
              (inv: any) => inv.status === 'OVERDUE',
            )
            const hasPending = leadInvoices.some(
              (inv: any) => inv.status === 'PENDING',
            )
            lead.scoring = hasOverdue
              ? 'D - Deudor'
              : hasPending
                ? 'B - Bueno'
                : 'A - Excelente'
            lead.crmSynced = true
            await lead.save()
          }
        }
        continue
      }

      if (subscriptionType === 'invoice.upsert') {
        let invoice = await Invoice.findOne({ crmId })
        let leadDoc = null

        if (!invoice) {
          const leadCrmId = await crm.fetchLeadIdAssociatedWithInvoice(crmId)
          if (!leadCrmId) {
            console.warn(
              `[Webhook CRM] No se encontró contacto asociado para factura crmId ${crmId}`,
            )
            continue
          }

          leadDoc = await Lead.findOne({ crmId: leadCrmId })
          if (!leadDoc) {
            console.warn(
              `[Webhook CRM] Lead local no encontrado para leadCrmId ${leadCrmId} de factura crmId ${crmId}`,
            )
            continue
          }

          invoice = new Invoice({
            crmId,
            leadId: leadDoc._id,
            userId: leadDoc.userId || defaultUserId,
            amount: 0,
            balanceDue: 0,
            status: 'PENDING',
            invoiceDate: new Date(),
            dueDate: new Date(),
          })
        } else {
          leadDoc = await Lead.findById(invoice.leadId)
        }

        // Siempre traemos el estado completo y autoritativo desde el CRM en vez de
        // parchear campo a campo: así el webhook solo necesita avisar el ID que cambió
        // (válido para cualquier proveedor) y no se pierde información si algún evento
        // intermedio no llega.
        const fullInvoice = await crm.fetchInvoiceById(crmId)
        if (fullInvoice) {
          invoice.amount = fullInvoice.amount
          invoice.balanceDue =
            fullInvoice.balanceDue ??
            (fullInvoice.status === 'PAID' ? 0 : fullInvoice.amount)
          invoice.status = fullInvoice.status
          invoice.invoiceDate = new Date(fullInvoice.invoiceDate)
          invoice.dueDate = new Date(fullInvoice.dueDate)
          if (fullInvoice.paymentDate) {
            invoice.paymentDate = new Date(fullInvoice.paymentDate)
          }
        } else if (event.propertyName && event.propertyValue !== undefined) {
          // Fallback si el proveedor no pudo recuperar el registro completo (p. ej. ya se borró)
          const val = event.propertyValue
          switch (event.propertyName) {
            case 'amount':
              invoice.amount = parseFloat(val || '0') || 0
              break
            case 'balanceDue':
              invoice.balanceDue = parseFloat(val || '0') || 0
              break
            case 'status':
              invoice.status = val as any
              break
            case 'invoiceDate':
              invoice.invoiceDate = new Date(val)
              break
            case 'dueDate':
              invoice.dueDate = new Date(val)
              break
            case 'paymentDate':
              invoice.paymentDate = val ? new Date(val) : undefined
              break
          }
        }

        await invoice.save()
        console.log(
          `[Webhook CRM] Factura crmId ${crmId} guardada/actualizada.`,
        )

        if (leadDoc) {
          const leadInvoices = await Invoice.find({ leadId: leadDoc._id })
          const hasOverdue = leadInvoices.some(
            (inv: any) => inv.status === 'OVERDUE',
          )
          const hasPending = leadInvoices.some(
            (inv: any) => inv.status === 'PENDING',
          )
          leadDoc.scoring = hasOverdue
            ? 'D - Deudor'
            : hasPending
              ? 'B - Bueno'
              : 'A - Excelente'
          leadDoc.crmSynced = true
          await leadDoc.save()
          console.log(
            `[Webhook CRM] Scoring de Lead ${leadDoc.crmId} recalculado: ${leadDoc.scoring}`,
          )
        }
      }

      if (subscriptionType === 'deal.deletion') {
        await Deal.deleteOne({ crmId })
        console.log(`[Webhook CRM] Deal crmId ${crmId} eliminado por acción en CRM.`)
        continue
      }

      if (subscriptionType === 'deal.upsert') {
        // Resolvemos el Lead dueño del Deal: si ya existe localmente lo tomamos
        // de ahí, si no, le preguntamos al CRM a qué contacto está asociado.
        const existingDeal = await Deal.findOne({ crmId })
        let leadDoc = existingDeal
          ? await Lead.findById(existingDeal.leadId)
          : null

        if (!leadDoc) {
          const leadCrmId = await crm.fetchLeadIdAssociatedWithDeal(crmId)
          if (!leadCrmId) {
            console.warn(
              `[Webhook CRM] No se encontró contacto asociado para Deal crmId ${crmId}`,
            )
            continue
          }
          leadDoc = await Lead.findOne({ crmId: leadCrmId })
          if (!leadDoc) {
            console.warn(
              `[Webhook CRM] Lead local no encontrado para leadCrmId ${leadCrmId} de Deal crmId ${crmId}`,
            )
            continue
          }
        }

        if (!leadDoc.crmId) {
          console.warn(
            `[Webhook CRM] Lead ${leadDoc._id} del Deal crmId ${crmId} aún no tiene crmId asignado.`,
          )
          continue
        }

        // Reutilizamos la misma rutina que ya usa el flujo de polling: trae el
        // estado completo y autoritativo de los deals del lead desde el CRM
        // (mapeo de stage, metadata de termMonths/interestRate, etc.) en vez
        // de parchear campo a campo, igual que con las facturas.
        await syncDealsForLead(leadDoc, leadDoc.crmId, crm, leadDoc.userId, {
          bypassRecencyGuard: true,
        })
        console.log(`[Webhook CRM] Deals del lead ${leadDoc.crmId} resincronizados por evento de Deal crmId ${crmId}.`)
      }

      if (subscriptionType === 'association.creation') {
        const fromId = event.fromCrmId
        const toId = event.toCrmId

        const lead = await Lead.findOne({ crmId: fromId })
        const company = await Company.findOne({ crmId: toId })

        if (lead && company) {
          lead.companyId = company._id as any
          lead.crmSynced = true
          await lead.save()
          console.log(
            `[Webhook CRM] Lead ${fromId} asociado a empresa ${toId} en MongoDB.`,
          )
        }
      }

      if (subscriptionType === 'association.deletion') {
        const fromId = event.fromCrmId
        const lead = await Lead.findOne({ crmId: fromId })

        if (lead) {
          lead.companyId = null
          lead.crmSynced = true
          await lead.save()
          console.log(
            `[Webhook CRM] Asociación removida del lead ${fromId} en MongoDB.`,
          )
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error: any) {
    console.error('[Webhook CRM] Error en procesamiento de webhook:', error)
    return NextResponse.json(
      { error: error.message || 'Server Error' },
      { status: 500 },
    )
  }
}
