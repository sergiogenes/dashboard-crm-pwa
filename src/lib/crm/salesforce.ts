import jsforce, { Connection } from 'jsforce'
import {
  ICRMProvider,
  CRMLead,
  CRMCompany,
  CRMInvoice,
  CRMActivity,
  CRMDeal,
  ParsedCRMWebhookEvent,
} from './interface'

interface SalesforceSaveResult {
  success: boolean
  id: string
  errors: unknown[]
}

export class SalesforceProvider implements ICRMProvider {
  private conn: Connection | null = null
  private lastLoginTime = 0
  private tokenExpiryMs = 60 * 60 * 1000 // 1 hora de vigencia en caché para evitar re-logins innecesarios

  private async getConnection(): Promise<Connection> {
    const now = Date.now()
    if (this.conn && now - this.lastLoginTime < this.tokenExpiryMs) {
      return this.conn
    }

    const clientId = process.env.SALESFORCE_CLIENT_ID
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET
    const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'

    if (!clientId || !clientSecret) {
      throw new Error('Faltan variables de entorno SALESFORCE_CLIENT_ID o SALESFORCE_CLIENT_SECRET')
    }

    const params = new URLSearchParams()
    params.append('grant_type', 'client_credentials')
    params.append('client_id', clientId)
    params.append('client_secret', clientSecret)

    const tokenRes = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      throw new Error(`Fallo de autenticación Client Credentials en Salesforce: ${errText}`)
    }

    const tokenData = await tokenRes.json()

    this.conn = new Connection({
      accessToken: tokenData.access_token,
      instanceUrl: tokenData.instance_url,
    })
    this.lastLoginTime = Date.now()

    return this.conn
  }

  private isInvalidSessionError(err: unknown): boolean {
    return !!err && typeof err === 'object' && (err as { errorCode?: string }).errorCode === 'INVALID_SESSION_ID'
  }

  // El flujo Client Credentials no expone refresh_token, así que ante una sesión
  // invalidada antes de lo previsto por tokenExpiryMs (el timeout real lo decide
  // el org de Salesforce, no nosotros) forzamos un login nuevo y reintentamos una vez.
  private async withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
    const conn = await this.getConnection()
    try {
      return await fn(conn)
    } catch (err) {
      if (!this.isInvalidSessionError(err)) {
        throw err
      }
      this.conn = null
      this.lastLoginTime = 0
      const freshConn = await this.getConnection()
      return await fn(freshConn)
    }
  }

  async upsertLead(lead: CRMLead): Promise<string> {
    return this.withConnection(async (conn) => {
      // 1. Si ya tiene crmId, actualizamos directamente en Salesforce
      if (lead.crmId) {
        await conn.sobject('Contact').update({
          Id: lead.crmId,
          FirstName: lead.firstName,
          LastName: lead.lastName,
          Email: lead.email,
          Phone: lead.phone || '',
          National_ID_Number__c: lead.documentId || '',
          Scoring__c: lead.scoring || '',
          ...(lead.ownerId ? { OwnerId: lead.ownerId } : {}),
        })
        return lead.crmId
      }

      // 2. Si no tiene crmId, buscamos si existe duplicado por Email o DNI
      let queryStr = `SELECT Id FROM Contact WHERE Email = '${lead.email}'`
      if (lead.documentId) {
        queryStr += ` OR National_ID_Number__c = '${lead.documentId}'`
      }

      const searchResult = await conn.query<any>(queryStr)

      const contactData: any = {
        FirstName: lead.firstName,
        LastName: lead.lastName,
        Email: lead.email,
        Phone: lead.phone || '',
        National_ID_Number__c: lead.documentId || '',
        Scoring__c: lead.scoring || '',
        ...(lead.ownerId ? { OwnerId: lead.ownerId } : {}),
      }

      if (searchResult.totalSize > 0 && searchResult.records[0]) {
        const existingId = searchResult.records[0].Id
        await conn.sobject('Contact').update({ Id: existingId, ...contactData })
        return existingId
      }

      // 3. Crear nuevo si no se encontró duplicado
      const res = (await conn.sobject('Contact').create(contactData)) as unknown as SalesforceSaveResult
      if (!res.success) {
        throw new Error(`Error de creación de Contacto en Salesforce: ${JSON.stringify(res.errors)}`)
      }
      return res.id
    })
  }

  async upsertCompany(company: CRMCompany): Promise<string> {
    return this.withConnection(async (conn) => {
      if (company.crmId) {
        await conn.sobject('Account').update({
          Id: company.crmId,
          Name: company.name,
          Domain__c: company.domain || '',
        })
        return company.crmId
      }

      if (company.domain) {
        const searchResult = await conn.query<any>(
          `SELECT Id FROM Account WHERE Domain__c = '${company.domain}'`
        )
        if (searchResult.totalSize > 0 && searchResult.records[0]) {
          const existingId = searchResult.records[0].Id
          await conn.sobject('Account').update({
            Id: existingId,
            Name: company.name,
          })
          return existingId
        }
      }

      const res = (await conn.sobject('Account').create({
        Name: company.name,
        Domain__c: company.domain || '',
      })) as unknown as SalesforceSaveResult
      if (!res.success) {
        throw new Error(`Error de creación de Cuenta en Salesforce: ${JSON.stringify(res.errors)}`)
      }
      return res.id
    })
  }

  async associateLeadWithCompany(leadCrmId: string, companyCrmId: string): Promise<void> {
    await this.withConnection(async (conn) => {
      // En Salesforce, asociar Contacto con Cuenta es tan simple como actualizar el campo AccountId
      await conn.sobject('Contact').update({
        Id: leadCrmId,
        AccountId: companyCrmId,
      })
    })
  }

  async deleteLead(crmId: string): Promise<void> {
    await this.withConnection((conn) => conn.sobject('Contact').destroy(crmId))
  }

  async deleteCompany(crmId: string): Promise<void> {
    await this.withConnection((conn) => conn.sobject('Account').destroy(crmId))
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.withConnection(async (conn) => conn.query('SELECT Id FROM User LIMIT 1'))
      return true
    } catch (err) {
      console.error('[Salesforce Connection Error in checkHealth]:', err)
      return false
    }
  }

  async fetchLeadsByOwner(ownerId: string): Promise<CRMLead[]> {
    const result = await this.withConnection(async (conn) =>
      conn.query<any>(
        `SELECT Id, FirstName, LastName, Email, Phone, OwnerId, National_ID_Number__c, Scoring__c FROM Contact WHERE OwnerId = '${ownerId}'`
      )
    )
    return result.records.map((item: any) => ({
      crmId: item.Id,
      firstName: item.FirstName || '',
      lastName: item.LastName || '',
      email: item.Email || '',
      phone: item.Phone || undefined,
      ownerId: item.OwnerId || undefined,
      documentId: item.National_ID_Number__c || undefined,
      scoring: item.Scoring__c || undefined,
    }))
  }

  async fetchAllCompanies(): Promise<CRMCompany[]> {
    const result = await this.withConnection(async (conn) =>
      conn.query<any>(`SELECT Id, Name, Domain__c FROM Account LIMIT 100`)
    )
    return result.records.map((item: any) => ({
      crmId: item.Id,
      name: item.Name || '',
      domain: item.Domain__c || undefined,
    }))
  }

  async fetchOwnerIdByEmail(email: string): Promise<string | undefined> {
    try {
      const result = await this.withConnection(async (conn) =>
        conn.query<any>(`SELECT Id FROM User WHERE Email = '${email}' LIMIT 1`)
      )
      if (result.totalSize > 0 && result.records[0]) {
        return result.records[0].Id
      }
      return undefined
    } catch (err) {
      console.error('[Salesforce Provider] Error buscando propietario por email:', err)
      return undefined
    }
  }

  async searchLeads(query: string): Promise<CRMLead[]> {
    try {
      const cleanQuery = query.trim()
      const isNumeric = /^\d+$/.test(cleanQuery)

      let queryStr = `SELECT Id, FirstName, LastName, Email, Phone, OwnerId, National_ID_Number__c, Scoring__c FROM Contact`
      if (isNumeric) {
        queryStr += ` WHERE National_ID_Number__c = '${cleanQuery}'`
      } else {
        queryStr += ` WHERE FirstName LIKE '%${cleanQuery}%' OR LastName LIKE '%${cleanQuery}%' OR Email LIKE '%${cleanQuery}%'`
      }
      queryStr += ` LIMIT 20`

      const result = await this.withConnection(async (conn) => conn.query<any>(queryStr))
      return result.records.map((item: any) => ({
        crmId: item.Id,
        firstName: item.FirstName || '',
        lastName: item.LastName || '',
        email: item.Email || '',
        phone: item.Phone || undefined,
        ownerId: item.OwnerId || undefined,
        documentId: item.National_ID_Number__c || undefined,
        scoring: item.Scoring__c || undefined,
      }))
    } catch (err) {
      console.error('[Salesforce Provider] Error buscando contactos:', err)
      return []
    }
  }

  async fetchInvoicesByLead(leadCrmId: string): Promise<CRMInvoice[]> {
    try {
      const result = await this.withConnection(async (conn) =>
        conn.query<any>(
          `SELECT Id, Amount__c, Balance_Due__c, Status__c, Invoice_Date__c, Due_Date__c, Payment_Date__c FROM Invoice__c WHERE Contact__c = '${leadCrmId}'`
        )
      )
      return result.records.map((item: any) => ({
        crmId: item.Id,
        amount: item.Amount__c || 0,
        balanceDue: item.Balance_Due__c || 0,
        status: (item.Status__c || 'PENDING') as 'PAID' | 'PENDING' | 'OVERDUE',
        invoiceDate: item.Invoice_Date__c || new Date().toISOString(),
        dueDate: item.Due_Date__c || new Date().toISOString(),
        paymentDate: item.Payment_Date__c || undefined,
      }))
    } catch (err) {
      console.error('[Salesforce Provider] Error obteniendo facturas:', err)
      return []
    }
  }

  async fetchActivitiesByLead(leadCrmId: string): Promise<CRMActivity[]> {
    try {
      // En Salesforce las actividades se almacenan en el objeto estándar Task (Tarea).
      // Filtramos por WhoId que es el Lookup hacia el Contacto.
      const result = await this.withConnection(async (conn) =>
        conn.query<any>(
          `SELECT Id, Subject, Description, ActivityDate, CreatedDate, Status, Priority, ReminderDateTime, IsReminderSet FROM Task WHERE WhoId = '${leadCrmId}'`
        )
      )

      return result.records.map((item: any) => {
        const subject = item.Subject || ''
        let type: CRMActivity['type'] = 'NOTE'
        let title = subject

        // Desencriptamos el tipo codificado en el Asunto
        if (subject.startsWith('[CALL] ')) {
          type = 'CALL'
          title = subject.substring(7)
        } else if (subject.startsWith('[MEETING] ')) {
          type = 'MEETING'
          title = subject.substring(10)
        } else if (subject.startsWith('[EMAIL] ')) {
          type = 'EMAIL'
          title = subject.substring(8)
        } else if (subject.startsWith('[TASK] ')) {
          type = 'TASK'
          title = subject.substring(7)
        } else if (subject.startsWith('[WHATSAPP] ')) {
          type = 'WHATSAPP'
          title = subject.substring(11)
        } else if (subject.startsWith('[NOTE] ')) {
          type = 'NOTE'
          title = subject.substring(7)
        }

        return {
          crmId: item.Id,
          type,
          title,
          body: item.Description || '',
          // CreatedDate es la fecha real de creación de la nota (inmutable en Salesforce).
          // ActivityDate representa el vencimiento/recordatorio, no debe usarse como timestamp.
          timestamp: item.CreatedDate ? new Date(item.CreatedDate).toISOString() : new Date().toISOString(),
          reminderDate: item.ReminderDateTime ? String(new Date(item.ReminderDateTime).getTime()) : undefined,
          reminderRead: item.Status === 'Completed',
          reminderStatus:
            item.Status === 'Completed'
              ? 'completed'
              : item.Status === 'Not Started'
                ? 'active'
                : 'waiting',
          reminderPriority:
            item.Priority === 'High'
              ? 'HIGH'
              : item.Priority === 'Low'
                ? 'LOW'
                : 'MEDIUM',
        }
      })
    } catch (err) {
      console.error('[Salesforce Provider] Error obteniendo actividades:', err)
      return []
    }
  }

  async createActivity(leadCrmId: string, activity: CRMActivity): Promise<string> {
    return this.withConnection(async (conn) => {
      // Codificamos el tipo de actividad en el Asunto de la Tarea para evitar requerir campos custom en Salesforce
      const subject = `[${activity.type}] ${activity.title}`

      // La Fecha de vencimiento (ActivityDate) debe reflejar el recordatorio cuando existe;
      // de lo contrario Salesforce muestra la fecha de creación como si fuera la alarma.
      const dueDate = activity.reminderDate
        ? new Date(parseInt(activity.reminderDate))
        : activity.timestamp
          ? new Date(activity.timestamp)
          : new Date()

      // reminderStatus es la fuente de verdad; reminderRead (deprecado) es
      // el fallback para llamadas que todavía no lo mandan.
      const sfStatusMap: Record<string, string> = {
        active: 'Not Started',
        waiting: 'Waiting on someone else',
        completed: 'Completed',
      }
      const resolvedStatus =
        activity.reminderStatus ||
        (activity.reminderRead ? 'waiting' : 'active')
      const sfPriorityMap: Record<string, string> = {
        LOW: 'Low',
        MEDIUM: 'Normal',
        HIGH: 'High',
      }

      const taskData: any = {
        WhoId: leadCrmId,
        Subject: subject,
        Description: activity.body,
        Status: sfStatusMap[resolvedStatus] || 'Not Started',
        Priority: sfPriorityMap[activity.reminderPriority || 'MEDIUM'],
        ActivityDate: dueDate.toISOString().substring(0, 10),
        IsReminderSet: !!activity.reminderDate,
        ...(activity.reminderDate ? { ReminderDateTime: new Date(parseInt(activity.reminderDate)).toISOString() } : {}),
      }

      if (activity.crmId) {
        await conn.sobject('Task').update({
          Id: activity.crmId,
          ...taskData,
        })
        return activity.crmId
      }

      const res = (await conn.sobject('Task').create(taskData)) as unknown as SalesforceSaveResult
      if (!res.success) {
        throw new Error(`Error creando Tarea en Salesforce: ${JSON.stringify(res.errors)}`)
      }
      return res.id
    })
  }

  async deleteActivity(crmId: string, type?: string): Promise<void> {
    // En Salesforce todas nuestras actividades son Tareas, simplificando enormemente el borrado
    await this.withConnection((conn) => conn.sobject('Task').destroy(crmId))
  }

  async upsertDeal(deal: CRMDeal): Promise<string> {
    return this.withConnection(async (conn) => {
      // Oportunidades en Salesforce requieren obligatoriamente una fecha de cierre (CloseDate)
      const closeDateStr = deal.closedDate
        ? deal.closedDate.substring(0, 10)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)

      const dealData: any = {
        Name: deal.name,
        Amount: deal.amount,
        StageName: this.mapLocalStageToSalesforce(deal.stage),
        CloseDate: closeDateStr,
        Description: deal.description || '',
        ...(deal.ownerId ? { OwnerId: deal.ownerId } : {}),
      }

      if (deal.crmId) {
        await conn.sobject('Opportunity').update({
          Id: deal.crmId,
          ...dealData,
        })
        return deal.crmId
      }

      const res = (await conn.sobject('Opportunity').create(dealData)) as unknown as SalesforceSaveResult
      if (!res.success) {
        throw new Error(`Error creando Oportunidad en Salesforce: ${JSON.stringify(res.errors)}`)
      }
      return res.id
    })
  }

  async deleteDeal(crmId: string): Promise<void> {
    await this.withConnection((conn) => conn.sobject('Opportunity').destroy(crmId))
  }

  async associateDealWithLead(dealCrmId: string, leadCrmId: string): Promise<void> {
    await this.withConnection(async (conn) => {
      // En Salesforce se asocia una Oportunidad a un Contacto mediante OpportunityContactRole
      const existing = await conn.query<any>(
        `SELECT Id FROM OpportunityContactRole WHERE OpportunityId = '${dealCrmId}' AND ContactId = '${leadCrmId}'`
      )

      if (existing.totalSize === 0) {
        const res = (await conn.sobject('OpportunityContactRole').create({
          OpportunityId: dealCrmId,
          ContactId: leadCrmId,
          Role: 'Decision Maker',
          IsPrimary: true,
        })) as unknown as SalesforceSaveResult
        if (!res.success) {
          throw new Error(`Error asociando Oportunidad y Contacto: ${JSON.stringify(res.errors)}`)
        }
      }
    })
  }

  async fetchDealsByLead(leadCrmId: string): Promise<CRMDeal[]> {
    try {
      return await this.withConnection(async (conn) => {
        // 1. Buscamos qué Oportunidades están vinculadas a este contacto
        const rolesResult = await conn.query<any>(
          `SELECT OpportunityId FROM OpportunityContactRole WHERE ContactId = '${leadCrmId}'`
        )

        const oppIds = rolesResult.records.map((r: any) => r.OpportunityId)
        if (oppIds.length === 0) return []

        const oppIdsList = oppIds.map((id: string) => `'${id}'`).join(',')

        // 2. Consultamos los datos de esas Oportunidades
        const oppResult = await conn.query<any>(
          `SELECT Id, Name, Amount, StageName, Description, CloseDate, OwnerId FROM Opportunity WHERE Id IN (${oppIdsList})`
        )

        return oppResult.records.map((item: any) => ({
          crmId: item.Id,
          name: item.Name || '',
          amount: item.Amount || 0,
          stage: this.mapSalesforceStageToLocal(item.StageName),
          description: item.Description || undefined,
          closedDate: item.CloseDate ? new Date(item.CloseDate).toISOString() : undefined,
          ownerId: item.OwnerId || undefined,
        }))
      })
    } catch (err) {
      console.error('[Salesforce Provider] Error obteniendo Deals:', err)
      return []
    }
  }

  async fetchInvoiceById(invoiceCrmId: string): Promise<CRMInvoice | null> {
    try {
      const result = await this.withConnection(async (conn) =>
        conn.query<any>(
          `SELECT Id, Amount__c, Balance_Due__c, Status__c, Invoice_Date__c, Due_Date__c, Payment_Date__c FROM Invoice__c WHERE Id = '${invoiceCrmId}' LIMIT 1`
        )
      )
      if (result.totalSize === 0 || !result.records[0]) return null

      const item = result.records[0]
      return {
        crmId: item.Id,
        amount: item.Amount__c || 0,
        balanceDue: item.Balance_Due__c || 0,
        status: (item.Status__c || 'PENDING') as 'PAID' | 'PENDING' | 'OVERDUE',
        invoiceDate: item.Invoice_Date__c || new Date().toISOString(),
        dueDate: item.Due_Date__c || new Date().toISOString(),
        paymentDate: item.Payment_Date__c || undefined,
      }
    } catch (err) {
      console.error('[Salesforce Provider] Error obteniendo factura por ID:', err)
      return null
    }
  }

  async fetchLeadIdAssociatedWithInvoice(invoiceCrmId: string): Promise<string | null> {
    try {
      const result = await this.withConnection(async (conn) =>
        conn.query<any>(`SELECT Contact__c FROM Invoice__c WHERE Id = '${invoiceCrmId}' LIMIT 1`)
      )
      if (result.totalSize === 0 || !result.records[0]) return null
      return result.records[0].Contact__c || null
    } catch (err) {
      console.error('[Salesforce Provider] Error obteniendo Contacto asociado a factura:', err)
      return null
    }
  }

  async fetchLeadIdAssociatedWithDeal(dealCrmId: string): Promise<string | null> {
    try {
      const result = await this.withConnection(async (conn) =>
        conn.query<any>(
          `SELECT ContactId FROM OpportunityContactRole WHERE OpportunityId = '${dealCrmId}' LIMIT 1`
        )
      )
      if (result.totalSize === 0 || !result.records[0]) return null
      return result.records[0].ContactId || null
    } catch (err) {
      console.error('[Salesforce Provider] Error obteniendo Contacto asociado a Oportunidad:', err)
      return null
    }
  }

  async verifyAndParseWebhook(req: Request, rawBody: string): Promise<ParsedCRMWebhookEvent[] | null> {
    try {
      // Opcional: verificación de token de seguridad enviado por los flujos de Salesforce
      const sfToken = req.headers.get('x-salesforce-webhook-token')
      const expectedToken = process.env.SALESFORCE_WEBHOOK_SECRET
      if (expectedToken && sfToken !== expectedToken) {
        console.warn('[Salesforce Webhook] Token de webhook inválido')
        return null
      }

      const body = JSON.parse(rawBody)

      if (body.events && Array.isArray(body.events)) {
        return body.events as ParsedCRMWebhookEvent[]
      }

      if (body.type && body.crmId) {
        return [
          {
            subscriptionType: body.type,
            crmId: body.crmId,
            propertyName: body.propertyName,
            propertyValue: body.propertyValue,
            fromCrmId: body.fromCrmId,
            toCrmId: body.toCrmId,
          },
        ]
      }

      return null
    } catch (err) {
      console.error('[Salesforce Webhook] Error parseando webhook:', err)
      return null
    }
  }

  // Métodos auxiliares de mapeo de etapas (Opportunity.StageName)
  private mapLocalStageToSalesforce(stage: string): string {
    switch (stage) {
      case 'draft':
        return 'Prospecting'
      case 'under_evaluation':
        return 'Qualification'
      case 'approved':
        return 'Needs Analysis'
      case 'disbursed':
        return 'Closed Won'
      case 'refused':
      case 'overdue':
        return 'Closed Lost'
      case 'completed':
        return 'Closed Won'
      default:
        return 'Prospecting'
    }
  }

  private mapSalesforceStageToLocal(stage: string): string {
    switch (stage) {
      case 'Prospecting':
        return 'draft'
      case 'Qualification':
      case 'Needs Analysis':
      case 'Value Proposition':
      case 'Id. Decision Makers':
      case 'Perception Analysis':
      case 'Proposal/Price Quote':
      case 'Negotiation/Review':
        return 'under_evaluation'
      case 'Closed Won':
        return 'disbursed'
      case 'Closed Lost':
        return 'refused'
      default:
        return 'draft'
    }
  }
}
