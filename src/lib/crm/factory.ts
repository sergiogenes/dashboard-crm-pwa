import { ICRMProvider } from './interface'
import { HubSpotProvider } from './hubspot'
import { SalesforceProvider } from './salesforce'
import { MockCRMProvider } from './mock'

export class CRMProviderFactory {
  // Next.js App Router compila el código en capas de módulos aisladas entre sí
  // (rsc, action-browser, edge, etc.), cada una con su propia copia de este archivo.
  // Un campo estático de clase daría una instancia distinta por capa, lo que para
  // proveedores con estado de sesión (p. ej. Salesforce) generaba logins concurrentes
  // que se invalidaban entre sí. Usamos globalThis para compartir una única instancia
  // (y una única sesión CRM) en todo el proceso, igual que ya se hacía con el mock.
  public static getProvider(): ICRMProvider {
    const isTest = process.env.IS_PLAYWRIGHT_TEST === 'true'
    const providerType = (isTest ? 'mock' : process.env.CRM_PROVIDER || 'mock').toLowerCase()

    const g = globalThis as any
    if (g.__crmProviderInstance && g.__crmProviderType === providerType) {
      return g.__crmProviderInstance
    }

    let instance: ICRMProvider

    switch (providerType) {
      case 'mock':
        instance = new MockCRMProvider()
        break

      case 'hubspot': {
        const token = process.env.HUBSPOT_ACCESS_TOKEN
        if (!token) {
          throw new Error('HUBSPOT_ACCESS_TOKEN is not defined in environment variables')
        }
        instance = new HubSpotProvider(token)
        break
      }

      case 'salesforce':
        instance = new SalesforceProvider()
        break

      default:
        throw new Error(`Provider ${providerType} not supported`)
    }

    g.__crmProviderInstance = instance
    g.__crmProviderType = providerType
    return instance
  }
}
