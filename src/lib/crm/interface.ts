export interface CRMLead {
  crmId?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  ownerId?: string
}

export interface CRMCompany {
  crmId?: string
  name: string
  domain?: string
}

export interface ICRMProvider {
  /**
   * Crea o actualiza un contacto en el CRM.
   * Si no tiene crmId, busca si existe por email para evitar duplicados.
   * Retorna el ID único del CRM.
   */
  upsertLead(lead: CRMLead): Promise<string>

  /**
   * Crea o actualiza una empresa en el CRM.
   * Si no tiene crmId y tiene dominio, busca si existe para evitar duplicados.
   * Retorna el ID único del CRM.
   */
  upsertCompany(company: CRMCompany): Promise<string>

  /**
   * Asocia un contacto (lead) a una empresa en el CRM utilizando la relación standard de HubSpot.
   */
  associateLeadWithCompany(leadCrmId: string, companyCrmId: string): Promise<void>

  /**
   * Elimina/archiva un contacto en el CRM.
   */
  deleteLead(crmId: string): Promise<void>

  /**
   * Elimina/archiva una empresa en el CRM.
   */
  deleteCompany(crmId: string): Promise<void>

  /**
   * Comprueba si la conexión con la API del CRM es saludable.
   */
  checkHealth(): Promise<boolean>
  fetchLeadsByOwner(ownerId: string): Promise<CRMLead[]>
  fetchAllCompanies(): Promise<CRMCompany[]>
}
