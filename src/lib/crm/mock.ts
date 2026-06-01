import { ICRMProvider, CRMLead, CRMCompany, CRMInvoice, CRMActivity } from './interface'

export class MockCRMProvider implements ICRMProvider {
  private contacts = new Map<string, CRMLead>()
  private companies = new Map<string, CRMCompany>()
  private associations = new Map<string, string>() // contactCrmId -> companyCrmId
  private mockActivities = new Map<string, CRMActivity[]>() // contactCrmId -> CRMActivity[]

  async upsertLead(lead: CRMLead): Promise<string> {
    const crmId = lead.crmId || `mock_contact_${Math.random().toString(36).substring(2, 9)}`
    this.contacts.set(crmId, { ...lead, crmId })
    return crmId
  }

  async upsertCompany(company: CRMCompany): Promise<string> {
    const crmId = company.crmId || `mock_company_${Math.random().toString(36).substring(2, 9)}`
    this.companies.set(crmId, { ...company, crmId })
    return crmId
  }

  async associateLeadWithCompany(leadCrmId: string, companyCrmId: string): Promise<void> {
    if (!this.contacts.has(leadCrmId)) {
      throw new Error(`Contact ${leadCrmId} not found in mock CRM`)
    }
    if (!this.companies.has(companyCrmId)) {
      throw new Error(`Company ${companyCrmId} not found in mock CRM`)
    }
    this.associations.set(leadCrmId, companyCrmId)
  }

  async deleteLead(crmId: string): Promise<void> {
    this.contacts.delete(crmId)
    this.associations.delete(crmId)
  }

  async deleteCompany(crmId: string): Promise<void> {
    this.companies.delete(crmId)
    // Limpia asociaciones relacionadas
    const keysToDelete: string[] = []
    this.associations.forEach((compId, leadId) => {
      if (compId === crmId) {
        keysToDelete.push(leadId)
      }
    })
    keysToDelete.forEach((leadId) => {
      this.associations.delete(leadId)
    })
  }

  async checkHealth(): Promise<boolean> {
    return true
  }

  async fetchLeadsByOwner(ownerId: string): Promise<CRMLead[]> {
    // Retornar la lista en memoria que coincida con el ownerId, calculando su scoring
    const leads = Array.from(this.contacts.values()).filter(lead => lead.ownerId === ownerId)
    
    for (const lead of leads) {
      if (lead.crmId) {
        const invoices = await this.fetchInvoicesByLead(lead.crmId)
        const hasOverdue = invoices.some(inv => inv.status === 'OVERDUE')
        const hasPending = invoices.some(inv => inv.status === 'PENDING')
        
        if (hasOverdue) {
          lead.scoring = 'D - Deudor'
        } else if (hasPending) {
          lead.scoring = 'B - Bueno'
        } else {
          lead.scoring = 'A - Excelente'
        }
      }
    }

    return leads
  }

  async fetchAllCompanies(): Promise<CRMCompany[]> {
    // Retornar todas las empresas en memoria
    return Array.from(this.companies.values())
  }

  async fetchOwnerIdByEmail(email: string): Promise<string | undefined> {
    return 'mock_owner_id'
  }

  async fetchInvoicesByLead(leadCrmId: string): Promise<CRMInvoice[]> {
    // Generar facturas deterministas según el leadCrmId para consistencia visual
    const hash = leadCrmId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const count = (hash % 3) + 2 // 2 a 4 facturas

    const invoices: CRMInvoice[] = []
    const baseDate = new Date('2026-01-15T12:00:00.000Z')

    for (let i = 0; i < count; i++) {
      const invoiceDate = new Date(baseDate.getTime() + i * 30 * 24 * 60 * 60 * 1000)
      const dueDate = new Date(invoiceDate.getTime() + 15 * 24 * 60 * 60 * 1000)
      
      // Estado de factura basado en el índice y hash
      let status: 'PAID' | 'PENDING' | 'OVERDUE' = 'PAID'
      let paymentDate: string | undefined = undefined

      if (i === count - 1) {
        // La última factura depende del hash
        if (hash % 5 === 0) {
          status = 'OVERDUE'
        } else if (hash % 3 === 0) {
          status = 'PENDING'
        } else {
          status = 'PAID'
          paymentDate = new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
        }
      } else {
        status = 'PAID'
        paymentDate = new Date(dueDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
      }

      const amountVal = ((hash + i * 17) % 500) + 100 // montos deterministas entre $100 y $600
      invoices.push({
        crmId: `mock_inv_${leadCrmId}_${i}`,
        amount: amountVal,
        balanceDue: status === 'PAID' ? 0 : amountVal,
        status,
        invoiceDate: invoiceDate.toISOString(),
        dueDate: dueDate.toISOString(),
        paymentDate
      })
    }

    return invoices
  }

  async fetchActivitiesByLead(leadCrmId: string): Promise<CRMActivity[]> {
    return this.mockActivities.get(leadCrmId) || []
  }

  async createActivity(leadCrmId: string, activity: CRMActivity): Promise<string> {
    const crmId = activity.crmId || `mock_act_${Math.random().toString(36).substring(2, 9)}`
    const list = this.mockActivities.get(leadCrmId) || []
    const newActivity = { ...activity, crmId }
    list.push(newActivity)
    this.mockActivities.set(leadCrmId, list)
    return crmId
  }

  async deleteActivity(crmId: string): Promise<void> {
    this.mockActivities.forEach((acts) => {
      const idx = acts.findIndex((a) => a.crmId === crmId)
      if (idx !== -1) {
        acts.splice(idx, 1)
      }
    })
  }
}
