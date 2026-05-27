import { ICRMProvider, CRMLead, CRMCompany } from './interface'

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
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
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
    const searchResult = await this.request<HubSpotSearchResponse<HubSpotContactResponse>>('/contacts/search', {
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
    const newContact = await this.request<HubSpotContactResponse>('/contacts', {
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
    })

    return newContact.id
  }

  async upsertCompany(company: CRMCompany): Promise<string> {
    // Si ya tiene crmId, actualizamos directamente
    if (company.crmId) {
      await this.request<HubSpotCompanyResponse>(`/companies/${company.crmId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: {
            name: company.name,
            domain: company.domain || '',
          },
        }),
      })
      return company.crmId
    }

    // Si no tiene crmId pero tiene dominio, buscamos duplicados
    if (company.domain) {
      const searchResult = await this.request<HubSpotSearchResponse<HubSpotCompanyResponse>>('/companies/search', {
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
    const newCompany = await this.request<HubSpotCompanyResponse>('/companies', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          name: company.name,
          domain: company.domain || '',
        },
      }),
    })

    return newCompany.id
  }

  async associateLeadWithCompany(leadCrmId: string, companyCrmId: string): Promise<void> {
    // URL en HubSpot v3 para asociación: /contacts/{contactId}/associations/companies/{companyId}/contact_to_company
    await this.request<void>(
      `/contacts/${leadCrmId}/associations/companies/${companyCrmId}/contact_to_company`,
      {
        method: 'PUT',
      }
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

  async checkHealth(): Promise<boolean> {
    try {
      // Endpoint rápido con límite 1 para comprobar conectividad del token
      const result = await this.request<HubSpotSearchResponse<HubSpotContactResponse>>('/contacts?limit=1', {
        method: 'GET',
      })
      return !!result
    } catch {
      return false
    }
  }

  async fetchLeadsByOwner(ownerId: string): Promise<CRMLead[]> {
    // Buscar contactos en HubSpot asignados a este ownerId
    const searchResult = await this.request<HubSpotSearchResponse<any>>('/contacts/search', {
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
        properties: ['firstname', 'lastname', 'email', 'phone', 'hubspot_owner_id'],
        limit: 100, // Límite estándar para sincronización
      }),
    })

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
    const result = await this.request<any>('/companies?limit=100&properties=name,domain', {
      method: 'GET',
    })

    const results = result.results || []

    return results.map((item: any) => ({
      crmId: item.id,
      name: item.properties.name || '',
      domain: item.properties.domain || undefined,
    }))
  }
}
