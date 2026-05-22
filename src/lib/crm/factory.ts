import { ICRMProvider } from './interface'
import { HubSpotProvider } from './hubspot'
import { MockCRMProvider } from './mock'

export class CRMProviderFactory {
  private static instance: ICRMProvider | null = null

  public static getProvider(): ICRMProvider {
    if (this.instance) {
      return this.instance
    }

    const providerType = process.env.CRM_PROVIDER || 'mock'

    switch (providerType.toLowerCase()) {
      case 'hubspot':
        const token = process.env.HUBSPOT_ACCESS_TOKEN
        if (!token) {
          throw new Error('HUBSPOT_ACCESS_TOKEN is not defined in environment variables')
        }
        this.instance = new HubSpotProvider(token)
        break

      case 'mock':
      default:
        this.instance = new MockCRMProvider()
        break
    }

    return this.instance
  }
}
