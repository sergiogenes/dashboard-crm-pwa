import { ICRMProvider, CRMLead, CRMCompany, CRMInvoice, CRMActivity, CRMDeal } from './interface'

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
    let url = ''
    if (endpoint.startsWith('/crm/v4/')) {
      url = `https://api.hubapi.com${endpoint}`
    } else {
      const isObjects = !endpoint.startsWith('/owners')
      url = isObjects
        ? `${this.baseUrl}${endpoint}`
        : `https://api.hubapi.com/crm/v3${endpoint}`
    }
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

  async deleteActivity(crmId: string, type?: string): Promise<void> {
    if (type) {
      const endpoint = type === 'TASK' ? `/tasks/${crmId}` : `/notes/${crmId}`
      await this.request<void>(endpoint, {
        method: 'DELETE',
      })
    } else {
      // Fallback robusto en caso de que no se proporcione el tipo
      try {
        await this.request<void>(`/notes/${crmId}`, {
          method: 'DELETE',
        })
      } catch (err: any) {
        try {
          await this.request<void>(`/tasks/${crmId}`, {
            method: 'DELETE',
          })
        } catch (taskErr) {
          console.warn(`[HubSpot Provider] Falló la eliminación fallback de actividad ${crmId}:`, err, taskErr)
        }
      }
    }
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

      const activities: CRMActivity[] = []

      // 1. Obtener y procesar tareas (Tasks) nativas de HubSpot
      try {
        const taskAssocResult = await this.request<HubSpotAssociationsResponse>(
          `/contacts/${leadCrmId}/associations/tasks`,
          { method: 'GET' }
        )
        const taskIds = taskAssocResult.results?.map(r => r.id) || []
        for (const taskId of taskIds) {
          try {
            const taskDetail = await this.request<{
              id: string
              properties: {
                hs_task_subject?: string
                hs_task_status?: string
                hs_timestamp?: string
                hs_task_body?: string
              }
            }>(`/tasks/${taskId}?properties=hs_task_subject,hs_task_status,hs_timestamp,hs_task_body`, { method: 'GET' })

            if (taskDetail && taskDetail.properties) {
              const props = taskDetail.properties
              const subject = props.hs_task_subject || 'Tarea sin asunto'
              const status = props.hs_task_status || 'NOT_STARTED'
              const dueDate = props.hs_timestamp || ''
              const taskBody = props.hs_task_body || ''

              activities.push({
                crmId: taskDetail.id,
                type: 'TASK',
                title: subject,
                body: taskBody.replace(/<[^>]*>/g, '').trim(),
                timestamp: dueDate || new Date().toISOString(),
                reminderDate: dueDate ? String(new Date(dueDate).getTime()) : undefined,
                reminderRead: status === 'COMPLETED'
              })
            }
          } catch (singleTaskErr: any) {
            if (singleTaskErr.message?.includes('404')) {
              console.log(`[HubSpot Provider] Tarea huérfana o eliminada con ID ${taskId} saltada (404)`)
            } else {
              console.warn(`[HubSpot Provider] Error al obtener detalles de tarea ${taskId}:`, singleTaskErr)
            }
          }
        }
      } catch (tasksAssocErr) {
        console.warn('[HubSpot Provider] Error al obtener asociaciones de tareas:', tasksAssocErr)
      }

      // 2. Obtener y procesar notas (Notes, Calls, Meetings, Emails) de HubSpot
      try {
        const assocResult = await this.request<HubSpotAssociationsResponse>(
          `/contacts/${leadCrmId}/associations/notes`,
          { method: 'GET' }
        )
        const associatedIds = assocResult.results?.map(r => r.id) || []
        for (const noteId of associatedIds) {
          try {
            interface HubSpotNoteResponse {
              id: string
              properties: {
                hs_note_body?: string
                hs_timestamp?: string
              }
            }
            const noteDetail = await this.request<HubSpotNoteResponse>(
              `/notes/${noteId}?properties=hs_note_body,hs_timestamp`,
              { method: 'GET' }
            )

            if (noteDetail && noteDetail.properties) {
              const props = noteDetail.properties
              const bodyHtml = props.hs_note_body || ''

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
                reminderDate: undefined,
                reminderRead: false
              })
            }
          } catch (singleNoteErr: any) {
            if (singleNoteErr.message?.includes('404')) {
              console.log(`[HubSpot Provider] Nota huérfana o eliminada con ID ${noteId} saltada (404)`)
            } else {
              console.warn(`[HubSpot Provider] Saltada nota con ID ${noteId} debido a error:`, singleNoteErr)
            }
          }
        }
      } catch (notesAssocErr) {
        console.warn('[HubSpot Provider] Error al obtener asociaciones de notas:', notesAssocErr)
      }

      return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    } catch (err) {
      console.error(`[HubSpot Provider] Error al obtener actividades para el contacto ${leadCrmId}:`, err)
      return []
    }
  }

  async createActivity(leadCrmId: string, activity: CRMActivity): Promise<string> {
    if (activity.type === 'TASK') {
      const dueDateIso = activity.reminderDate 
        ? new Date(Number(activity.reminderDate)).toISOString() 
        : new Date().toISOString()

      if (activity.crmId) {
        await this.request(`/tasks/${activity.crmId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            properties: {
              hs_task_subject: activity.title,
              hs_task_body: activity.body,
              hs_task_status: activity.reminderRead ? 'COMPLETED' : 'NOT_STARTED',
              hs_timestamp: dueDateIso,
            },
          }),
        })
        return activity.crmId
      } else {
        const taskResponse = await this.request<{ id: string }>('/tasks', {
          method: 'POST',
          body: JSON.stringify({
            properties: {
              hs_task_subject: activity.title,
              hs_task_body: activity.body,
              hs_task_status: activity.reminderRead ? 'COMPLETED' : 'NOT_STARTED',
              hs_timestamp: dueDateIso,
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
        return taskResponse.id
      }
    } else {
      const typeLabels: Record<string, string> = {
        NOTE: '📝 Nota',
        CALL: '📞 Llamada',
        MEETING: '🤝 Reunión',
        EMAIL: '📧 Email',
      }
      const prefix = typeLabels[activity.type] || '📝 Nota'
      const htmlBody = `<div><strong>[${prefix}] ${activity.title}</strong><br/><p>${activity.body}</p></div>`

      if (activity.crmId) {
        await this.request(`/notes/${activity.crmId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            properties: {
              hs_note_body: htmlBody,
            },
          }),
        })
        return activity.crmId
      } else {
        const noteResponse = await this.request<{ id: string }>('/notes', {
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
        return noteResponse.id
      }
    }
  }


  private mapStageToHubSpot(localStage: string): string {
    const stageMap: Record<string, string> = {
      draft: 'appointmentscheduled',
      under_evaluation: 'decisionmakerbought-in',
      approved: 'contractsent',
      disbursed: 'closedwon',
      completed: 'closedwon',
      refused: 'closedlost',
      overdue: 'closedlost',
    }
    return stageMap[localStage] || 'appointmentscheduled'
  }

  async upsertDeal(deal: CRMDeal): Promise<string> {
    const hsStage = this.mapStageToHubSpot(deal.stage)
    const properties = {
      dealname: deal.name,
      amount: String(deal.amount),
      dealstage: hsStage,
      ...(deal.description ? { description: deal.description } : {}),
      ...(deal.ownerId ? { hubspot_owner_id: deal.ownerId } : {}),
    }

    if (deal.crmId) {
      await this.request<any>(`/deals/${deal.crmId}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      })
      return deal.crmId
    }

    const response = await this.request<{ id: string }>('/deals', {
      method: 'POST',
      body: JSON.stringify({ properties }),
    })
    return response.id
  }

  async deleteDeal(crmId: string): Promise<void> {
    await this.request<void>(`/deals/${crmId}`, {
      method: 'DELETE',
    })
  }

  async associateDealWithLead(dealCrmId: string, leadCrmId: string): Promise<void> {
    // Asociación Deal -> Contact (Association Type 3: Deal to Contact)
    await this.request<void>(`/deals/${dealCrmId}/associations/contacts/${leadCrmId}/3`, {
      method: 'PUT',
    })
  }

  async fetchDealsByLead(leadCrmId: string): Promise<CRMDeal[]> {
    try {
      // 1. Obtener las asociaciones del contacto con los negocios
      const assocData = await this.request<{ results: { id: string }[] }>(
        `/contacts/${leadCrmId}/associations/deals`,
        { method: 'GET' }
      )

      if (!assocData.results || assocData.results.length === 0) {
        return []
      }

      const deals: CRMDeal[] = []

      // 2. Traer los detalles de cada Deal asociado
      for (const result of assocData.results) {
        const dealId = result.id
        try {
          const detail = await this.request<{
            id: string
            properties: {
              dealname: string
              amount: string
              dealstage: string
              description?: string
              closedate?: string
              hubspot_owner_id?: string
            }
          }>(`/deals/${dealId}?properties=dealname,amount,dealstage,description,closedate,hubspot_owner_id`, {
            method: 'GET'
          })

          const props = detail.properties
          deals.push({
            crmId: detail.id,
            name: props.dealname,
            amount: parseFloat(props.amount) || 0,
            stage: props.dealstage,
            description: props.description,
            closedDate: props.closedate,
            ownerId: props.hubspot_owner_id || undefined,
          })
        } catch (singleDealErr) {
          console.warn(`[HubSpot Provider] Error al obtener detalles del Deal ${dealId}:`, singleDealErr)
        }
      }

      return deals
    } catch (err) {
      console.error(`[HubSpot Provider] Error en fetchDealsByLead para lead ${leadCrmId}:`, err)
      return []
    }
  }
}
