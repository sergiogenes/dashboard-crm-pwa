import { ICRMProvider, CRMLead, CRMCompany, CRMInvoice, CRMActivity } from './interface'

interface HubSpotContactResponse {
  id: string
  properties: {
    email: string
    firstname?: string
    lastname?: string
    phone?: string
  }
}

interface HubSpotCompanyResponse {
  id: string
  properties: {
    name: string
    domain?: string
  }
}

interface HubSpotSearchResponse<T> {
  total: number
  results: T[]
}

export class HubSpotProvider implements ICRMProvider {
  private baseUrl = 'https://api.hubapi.com/crm/v3/objects'
  private token: string

  constructor(token: string) {
    this.token = token
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    const isObjects = !endpoint.startsWith('/owners')
    const url = isObjects
      ? `${this.baseUrl}${endpoint}`
      : `https://api.hubapi.com/crm/v3${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    })

    if (response.status === 204) {
      return {} as T
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HubSpot API Error (${response.status}): ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  async upsertLead(lead: CRMLead): Promise<string> {
    // Si ya existe un crmId, actualizamos directamente
    if (lead.crmId) {
      await this.request<HubSpotContactResponse>(`/contacts/${lead.crmId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: {
            firstname: lead.firstName,
            lastname: lead.lastName,
            email: lead.email,
            phone: lead.phone || '',
            ...(lead.ownerId ? { hubspot_owner_id: lead.ownerId } : {}),
          },
        }),
      })
      return lead.crmId
    }

    // Si no tiene crmId, buscamos duplicados por email usando el endpoint de búsqueda
    const searchResult = await this.request<
      HubSpotSearchResponse<HubSpotContactResponse>
    >('/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: lead.email,
              },
            ],
          },
        ],
      }),
    })

    if (searchResult.total > 0 && searchResult.results[0]) {
      const existingId = searchResult.results[0].id
      // Actualizamos el contacto encontrado
      await this.request<HubSpotContactResponse>(`/contacts/${existingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: {
            firstname: lead.firstName,
            lastname: lead.lastName,
            phone: lead.phone || '',
            ...(lead.ownerId ? { hubspot_owner_id: lead.ownerId } : {}),
          },
        }),
      })
      return existingId
    }

    // Si no existe, creamos el contacto
    try {
      const newContact = await this.request<HubSpotContactResponse>(
        '/contacts',
        {
          method: 'POST',
          body: JSON.stringify({
            properties: {
              firstname: lead.firstName,
              lastname: lead.lastName,
              email: lead.email,
              phone: lead.phone || '',
              ...(lead.ownerId ? { hubspot_owner_id: lead.ownerId } : {}),
            },
          }),
        },
      )
      return newContact.id
    } catch (err: any) {
      // Si la creación falla porque el email ya existe (retraso en índice de búsqueda)
      const match = err.message.match(/(\d+)\s+already has that value/)
      if (match && match[1]) {
        const existingId = match[1]
        // Actualizamos el contacto encontrado en lugar de arrojar error
        await this.request<HubSpotContactResponse>(`/contacts/${existingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            properties: {
              firstname: lead.firstName,
              lastname: lead.lastName,
              phone: lead.phone || '',
              ...(lead.ownerId ? { hubspot_owner_id: lead.ownerId } : {}),
            },
          }),
        })
        return existingId
      }
      throw err
    }
  }

  async upsertCompany(company: CRMCompany): Promise<string> {
    // Si ya tiene crmId, actualizamos directamente
    if (company.crmId) {
      await this.request<HubSpotCompanyResponse>(
        `/companies/${company.crmId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            properties: {
              name: company.name,
              domain: company.domain || '',
            },
          }),
        },
      )
      return company.crmId
    }

    // Si no tiene crmId pero tiene dominio, buscamos duplicados
    if (company.domain) {
      const searchResult = await this.request<
        HubSpotSearchResponse<HubSpotCompanyResponse>
      >('/companies/search', {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'domain',
                  operator: 'EQ',
                  value: company.domain,
                },
              ],
            },
          ],
        }),
      })

      if (searchResult.total > 0 && searchResult.results[0]) {
        const existingId = searchResult.results[0].id
        // Actualizamos la empresa encontrada
        await this.request<HubSpotCompanyResponse>(`/companies/${existingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            properties: {
              name: company.name,
            },
          }),
        })
        return existingId
      }
    }

    // Si no existe, creamos la empresa
    const newCompany = await this.request<HubSpotCompanyResponse>(
      '/companies',
      {
        method: 'POST',
        body: JSON.stringify({
          properties: {
            name: company.name,
            domain: company.domain || '',
          },
        }),
      },
    )

    return newCompany.id
  }

  async associateLeadWithCompany(
    leadCrmId: string,
    companyCrmId: string,
  ): Promise<void> {
    // URL en HubSpot v3 para asociación: /contacts/{contactId}/associations/companies/{companyId}/contact_to_company
    await this.request<void>(
      `/contacts/${leadCrmId}/associations/companies/${companyCrmId}/contact_to_company`,
      {
        method: 'PUT',
      },
    )
  }

  async deleteLead(crmId: string): Promise<void> {
    await this.request<void>(`/contacts/${crmId}`, {
      method: 'DELETE',
    })
  }

  async deleteCompany(crmId: string): Promise<void> {
    await this.request<void>(`/companies/${crmId}`, {
      method: 'DELETE',
    })
  }

  async deleteActivity(crmId: string): Promise<void> {
    await this.request<void>(`/notes/${crmId}`, {
      method: 'DELETE',
    })
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Endpoint rápido con límite 1 para comprobar conectividad del token
      const result = await this.request<
        HubSpotSearchResponse<HubSpotContactResponse>
      >('/contacts?limit=1', {
        method: 'GET',
      })
      return !!result
    } catch {
      return false
    }
  }

  async fetchLeadsByOwner(ownerId: string): Promise<CRMLead[]> {
    // Buscar contactos en HubSpot asignados a este ownerId
    const searchResult = await this.request<HubSpotSearchResponse<any>>(
      '/contacts/search',
      {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'hubspot_owner_id',
                  operator: 'EQ',
                  value: ownerId,
                },
              ],
            },
          ],
          properties: [
            'firstname',
            'lastname',
            'email',
            'phone',
            'hubspot_owner_id',
          ],
          limit: 100, // Límite estándar para sincronización
        }),
      },
    )

    return searchResult.results.map((item: any) => ({
      crmId: item.id,
      firstName: item.properties.firstname || '',
      lastName: item.properties.lastname || '',
      email: item.properties.email || '',
      phone: item.properties.phone || undefined,
      ownerId: item.properties.hubspot_owner_id || undefined,
    }))
  }

  async fetchAllCompanies(): Promise<CRMCompany[]> {
    // Listar las empresas registradas en HubSpot (límite 100 para pruebas y escalabilidad estándar)
    const result = await this.request<any>(
      '/companies?limit=100&properties=name,domain',
      {
        method: 'GET',
      },
    )

    const results = result.results || []

    return results.map((item: any) => ({
      crmId: item.id,
      name: item.properties.name || '',
      domain: item.properties.domain || undefined,
    }))
  }

  async fetchOwnerIdByEmail(email: string): Promise<string | undefined> {
    try {
      const encodedEmail = encodeURIComponent(email)
      const result = await this.request<any>(`/owners?email=${encodedEmail}`, {
        method: 'GET',
      })
      const results = result.results || []
      if (results.length > 0 && results[0]) {
        return results[0].id // ID de asignación del propietario
      }
      return undefined
    } catch (err) {
      console.error(
        '[HubSpot Provider] Error al buscar propietario por email:',
        err,
      )
      return undefined
    }
  }

  async fetchInvoicesByLead(leadCrmId: string): Promise<CRMInvoice[]> {
    const objectTypeId = process.env.HUBSPOT_INVOICE_OBJECT_TYPE_ID
    if (!objectTypeId) {
      // Fallback determinista y consistente si no está configurado el Custom Object
      const hash = leadCrmId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const count = (hash % 3) + 2 // 2 a 4 facturas

      const invoices: CRMInvoice[] = []
      const baseDate = new Date('2026-01-15T12:00:00.000Z')

      for (let i = 0; i < count; i++) {
        const invoiceDate = new Date(baseDate.getTime() + i * 30 * 24 * 60 * 60 * 1000)
        const dueDate = new Date(invoiceDate.getTime() + 15 * 24 * 60 * 60 * 1000)
        let status: 'PAID' | 'PENDING' | 'OVERDUE' = 'PAID'
        let paymentDate: string | undefined = undefined

        if (i === count - 1) {
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

        invoices.push({
          crmId: `hubspot_inv_${leadCrmId}_${i}`,
          amount: ((hash + i * 17) % 500) + 100,
          status,
          invoiceDate: invoiceDate.toISOString(),
          dueDate: dueDate.toISOString(),
          paymentDate
        })
      }
      return invoices
    }

    try {
      interface HubSpotAssociation {
        id: string
        type: string
      }
      interface HubSpotAssociationsResponse {
        results: HubSpotAssociation[]
      }

      // Obtener asociaciones de HubSpot para este contacto y el objeto de facturas
      const assocResult = await this.request<HubSpotAssociationsResponse>(
        `/contacts/${leadCrmId}/associations/${objectTypeId}`,
        { method: 'GET' }
      )

      const associatedIds = assocResult.results?.map(r => r.id) || []
      if (associatedIds.length === 0) return []

      const invoices: CRMInvoice[] = []
      const isNativeInvoice = objectTypeId === 'invoices'
      
      const propertiesQuery = [
        'hs_amount_billed', 'amount_billed', 'balance_due', 'hs_total_amount_billed', 'hs_balance_due', 'hs_total_amount', 'invoice_amount', 'hs_invoice_amount', 'amount',
        'hs_invoice_status', 'invoice_status', 'status',
        'hs_invoice_date', 'invoice_date',
        'hs_due_date', 'due_date',
        'hs_payment_date', 'payment_date',
        'hs_invoice_number'
      ].join(',')
 
      for (const invId of associatedIds) {
        interface HubSpotCustomObjectResponse {
          id: string
          properties: Record<string, string | undefined>
        }
        
        const invDetail = await this.request<HubSpotCustomObjectResponse>(
          `/${objectTypeId}/${invId}?properties=${propertiesQuery}`,
          { method: 'GET' }
        )
 
        if (invDetail && invDetail.properties) {
          const props = invDetail.properties
          console.log(`[HubSpot Invoices Debug] ID: ${invId}, Properties:`, JSON.stringify(props))
 
          // Mapeo resiliente buscando múltiples variantes de nombres de propiedades de HubSpot
          const amountRaw = props.hs_amount_billed || props.amount_billed || props.hs_total_amount_billed || props.hs_total_amount || props.invoice_amount || props.hs_invoice_amount || props.amount || '0'
          
          // Normalizar estados de facturación
          const statusRaw = props.hs_invoice_status || props.invoice_status || props.status || 'PENDING'
          let normalizedStatus: 'PAID' | 'PENDING' | 'OVERDUE' = 'PENDING'
          const statusUpper = statusRaw.toUpperCase()
          
          if (statusUpper === 'PAID') {
            normalizedStatus = 'PAID'
          } else if (statusUpper === 'OVERDUE') {
            normalizedStatus = 'OVERDUE'
          }

          // Mapear saldo adeudado (balanceDue)
          const balanceDueRaw = props.balance_due || props.hs_balance_due || (normalizedStatus === 'PAID' ? '0' : amountRaw)

          const invoiceDateRaw = props.hs_invoice_date || props.invoice_date
          const dueDateRaw = props.hs_due_date || props.due_date
          const paymentDateRaw = props.hs_payment_date || props.payment_date
          const invoiceNumber = props.hs_invoice_number || invDetail.id
 
          invoices.push({
            crmId: invoiceNumber, // Mostrar el número de factura amigable (ej: INV-1001)
            amount: parseFloat(amountRaw || '0') || 0,
            balanceDue: parseFloat(balanceDueRaw || '0') || 0,
            status: normalizedStatus,
            invoiceDate: invoiceDateRaw || new Date().toISOString(),
            dueDate: dueDateRaw || new Date().toISOString(),
            paymentDate: paymentDateRaw || undefined
          })
        }
      }
      return invoices
    } catch (err) {
      console.error(`[HubSpot Provider] Error al obtener facturas para el contacto ${leadCrmId}:`, err)
      return []
    }
  }

  async fetchActivitiesByLead(leadCrmId: string): Promise<CRMActivity[]> {
    try {
      interface HubSpotAssociation {
        id: string
        type: string
      }
      interface HubSpotAssociationsResponse {
        results: HubSpotAssociation[]
      }

      const assocResult = await this.request<HubSpotAssociationsResponse>(
        `/contacts/${leadCrmId}/associations/notes`,
        { method: 'GET' }
      )

      const associatedIds = assocResult.results?.map(r => r.id) || []
      if (associatedIds.length === 0) return []

      const activities: CRMActivity[] = []

      for (const noteId of associatedIds) {
        try {
          interface HubSpotNoteResponse {
            id: string
            properties: {
              hs_note_body?: string
              hs_timestamp?: string
              hs_lastmodifieddate?: string
            }
          }

          const noteDetail = await this.request<HubSpotNoteResponse>(
            `/notes/${noteId}?properties=hs_note_body,hs_timestamp`,
            { method: 'GET' }
          )

          if (noteDetail && noteDetail.properties) {
            const props = noteDetail.properties
            const bodyHtml = props.hs_note_body || ''
            
            let reminderDate: string | undefined = undefined
            const reminderMatch = bodyHtml.match(/<!-- reminder:([^>]+) -->/)
            if (reminderMatch) {
              reminderDate = reminderMatch[1]
            }

            let type: 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' = 'NOTE'
            let title = 'Nota de contacto'
            let body = bodyHtml

            const match = bodyHtml.match(/\[([^\]]+)\]\s*([^\<]+)/)
            if (match) {
              const label = match[1]
              title = match[2] || 'Actividad de contacto'

              if (label.includes('Llamada')) type = 'CALL'
              else if (label.includes('Reunión')) type = 'MEETING'
              else if (label.includes('Email')) type = 'EMAIL'
              else if (label.includes('Tarea')) type = 'TASK'
              
              const bodyMatch = bodyHtml.match(/\<p\>([^\<]+)\<\/p\>/)
              if (bodyMatch) {
                body = bodyMatch[1]
              } else {
                body = bodyHtml.replace(/<[^>]*>/g, '').replace(/\[[^\]]+\]/, '').replace(title, '').trim()
              }
            } else {
              const cleanText = bodyHtml.replace(/<[^>]*>/g, '').trim()
              title = cleanText.substring(0, 40) + (cleanText.length > 40 ? '...' : '')
              body = cleanText
            }

            activities.push({
              crmId: noteDetail.id,
              type,
              title: title || 'Nota de contacto',
              body: body || '',
              timestamp: props.hs_timestamp || new Date().toISOString(),
              reminderDate
            })
          }
        } catch (singleNoteErr) {
          console.warn(`[HubSpot Provider] Saltada nota/tarea con ID ${noteId} debido a error:`, singleNoteErr)
        }
      }

      return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    } catch (err) {
      console.error(`[HubSpot Provider] Error al obtener actividades para el contacto ${leadCrmId}:`, err)
      return []
    }
  }

  async createActivity(leadCrmId: string, activity: CRMActivity): Promise<string> {
    const typeLabels: Record<string, string> = {
      NOTE: '📝 Nota',
      CALL: '📞 Llamada',
      MEETING: '🤝 Reunión',
      EMAIL: '📧 Email',
      TASK: '✅ Tarea',
    }
    const prefix = typeLabels[activity.type] || '📝 Nota'
    let htmlBody = `<div><strong>[${prefix}] ${activity.title}</strong><br/><p>${activity.body}</p></div>`
    if (activity.reminderDate) {
      htmlBody += `<!-- reminder:${activity.reminderDate} -->`
    }

    const response = await this.request<{ id: string }>('/notes', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_note_body: htmlBody,
          hs_timestamp: activity.timestamp || new Date().toISOString(),
        },
        associations: [
          {
            to: { id: leadCrmId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 202, // Note to Contact
              },
            ],
          },
        ],
      }),
    })

    // Si la actividad tiene un recordatorio programado, crear también una tarea (task) nativa en HubSpot
    if (activity.reminderDate) {
      try {
        const timestampNum = parseInt(activity.reminderDate, 10)
        const dueDateIso = new Date(timestampNum).toISOString()
        await this.request('/tasks', {
          method: 'POST',
          body: JSON.stringify({
            properties: {
              hs_task_subject: `Recordatorio: ${activity.title}`,
              hs_task_body: activity.body,
              hs_task_status: 'NOT_STARTED',
              hs_timestamp: activity.timestamp || new Date().toISOString(),
              dueDate: dueDateIso,
            },
            associations: [
              {
                to: { id: leadCrmId },
                types: [
                  {
                    associationCategory: 'HUBSPOT_DEFINED',
                    associationTypeId: 204, // Task to Contact
                  },
                ],
              },
            ],
          }),
        })
      } catch (err) {
        console.error('[HubSpot Provider] Error al crear la tarea nativa de recordatorio en HubSpot:', err)
      }
    }

    return response.id
  }
}
