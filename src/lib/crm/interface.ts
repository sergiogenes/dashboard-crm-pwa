export interface CRMLead {
  crmId?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  ownerId?: string
  scoring?: string
}

export interface CRMCompany {
  crmId?: string
  name: string
  domain?: string
}

export interface CRMInvoice {
  crmId?: string
  amount: number
  balanceDue?: number
  status: 'PAID' | 'PENDING' | 'OVERDUE'
  invoiceDate: string // Formato fecha ISO
  dueDate: string // Formato fecha ISO
  paymentDate?: string // Formato fecha ISO
}

export interface CRMActivity {
  crmId?: string
  type: 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'TASK'
  title: string
  body: string
  timestamp: string // Formato fecha ISO
  reminderDate?: string // Formato fecha ISO
  reminderRead?: boolean
}

export interface CRMDeal {
  crmId?: string
  name: string
  amount: number
  stage: string // Etapa mapeada a HubSpot
  description?: string
  closedDate?: string // Formato fecha ISO
  ownerId?: string
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
  fetchOwnerIdByEmail(email: string): Promise<string | undefined>

  /**
   * Obtiene el historial de facturas de un contacto (Custom Object) desde el CRM.
   */
  fetchInvoicesByLead(leadCrmId: string): Promise<CRMInvoice[]>

  /**
   * Obtiene el historial de actividades de un contacto desde el CRM.
   */
  fetchActivitiesByLead(leadCrmId: string): Promise<CRMActivity[]>

  /**
   * Crea una nueva actividad asociada a un contacto en el CRM.
   */
  createActivity(leadCrmId: string, activity: CRMActivity): Promise<string>

  /**
   * Elimina/archiva una actividad (nota) en el CRM.
   */
  deleteActivity(crmId: string, type?: string): Promise<void>

  /**
   * Crea o actualiza un negocio (Deal) en el CRM.
   * Retorna el ID único del CRM.
   */
  upsertDeal(deal: CRMDeal): Promise<string>

  /**
   * Elimina/archiva un negocio en el CRM.
   */
  deleteDeal(crmId: string): Promise<void>

  /**
   * Asocia un negocio (Deal) con un contacto (Lead) en el CRM.
   */
  associateDealWithLead(dealCrmId: string, leadCrmId: string): Promise<void>

  /**
   * Obtiene todos los negocios (Deals) asociados a un contacto desde el CRM.
   */
  fetchDealsByLead(leadCrmId: string): Promise<CRMDeal[]>

  /**
   * Obtiene los detalles de una factura específica por su ID.
   */
  fetchInvoiceById(invoiceCrmId: string): Promise<CRMInvoice | null>

  /**
   * Obtiene el ID del contacto (Lead) asociado a una factura en el CRM.
   */
  fetchLeadIdAssociatedWithInvoice(invoiceCrmId: string): Promise<string | null>
}
