import { ICRMProvider, CRMLead, CRMCompany } from './interface'

export class MockCRMProvider implements ICRMProvider {
  private contacts = new Map<string, CRMLead>()
  private companies = new Map<string, CRMCompany>()
  private associations = new Map<string, string>() // contactCrmId -> companyCrmId

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
}
