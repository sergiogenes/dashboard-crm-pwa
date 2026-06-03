import { ICRMProvider } from './interface'
import { HubSpotProvider } from './hubspot'
import { MockCRMProvider } from './mock'

export class CRMProviderFactory {
  private static instance: ICRMProvider | null = null

  public static getProvider(): ICRMProvider {
    if (this.instance) {
      return this.instance
    }

    const isTest = process.env.IS_PLAYWRIGHT_TEST === 'true'
    const providerType = isTest ? 'mock' : (process.env.CRM_PROVIDER || 'mock')

    if (providerType.toLowerCase() === 'mock') {
      const g = globalThis as any
      if (!g.__mockCrmInstance) {
        g.__mockCrmInstance = new MockCRMProvider()
      }
      this.instance = g.__mockCrmInstance
      return g.__mockCrmInstance
    }

    switch (providerType.toLowerCase()) {
      case 'hubspot':
        const token = process.env.HUBSPOT_ACCESS_TOKEN
        if (!token) {
          throw new Error('HUBSPOT_ACCESS_TOKEN is not defined in environment variables')
        }
        this.instance = new HubSpotProvider(token)
        break

      default:
        throw new Error(`Provider ${providerType} not supported`)
    }

    return this.instance!
  }
}
