import { IMessagingProvider } from './interface'
import { InfobipMessagingProvider } from './providers/infobip'
import { MockMessagingProvider } from './providers/mock'

export class MessagingProviderFactory {
  private static instance: IMessagingProvider

  public static getProvider(): IMessagingProvider {
    if (this.instance) return this.instance

    const providerType = process.env.NEXT_PUBLIC_MESSAGING_PROVIDER || 'mock'

    switch (providerType) {
      case 'infobip':
        this.instance = new InfobipMessagingProvider({
          apiKey: process.env.INFOBIP_API_KEY || '',
          baseUrl: process.env.INFOBIP_BASE_URL || '',
          senderNumber: process.env.INFOBIP_SENDER_NUMBER || '',
        })
        break
      case 'mock':
      default:
        this.instance = new MockMessagingProvider()
        break
    }

    return this.instance
  }
}
