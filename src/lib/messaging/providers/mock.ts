import { IMessagingProvider, SendMessageOptions, SendMessageResult, ParsedWebhookMessage } from '../interface'

export class MockMessagingProvider implements IMessagingProvider {
  async sendMessage(
    to: string,
    body: string,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult> {
    console.log(`[Mock Messaging] Enviando WhatsApp a ${to}:`)
    if (options?.templateName) {
      console.log(
        `  - Plantilla: ${options.templateName} [${options.language || 'es'}]`,
      )
      console.log(`  - Marcadores: ${JSON.stringify(options.placeholders || [])}`)
    } else {
      console.log(`  - Cuerpo: "${body}"`)
    }

    return {
      success: true,
      messageId: `mock_msg_${Math.random().toString(36).substring(2, 11)}`,
    }
  }

  async getTemplates() {
    return [
      {
        name: 'welcome_template',
        label: 'Bienvenida (welcome_template)',
        language: 'es',
        text: 'Hola {{1}}, gracias por registrarte en Ceibo. Un asesor se pondrá en contacto pronto.',
        placeholders: ['Nombre del Lead'],
      },
      {
        name: 'follow_up_template',
        label: 'Seguimiento (follow_up_template)',
        language: 'es',
        text: 'Hola {{1}}, te escribimos para dar seguimiento a tu solicitud de crédito. ¿Tienes un momento?',
        placeholders: ['Nombre del Lead'],
      },
      {
        name: 'reminder_template',
        label: 'Recordatorio de Pago (reminder_template)',
        language: 'es',
        text: 'Estimado {{1}}, te recordamos que tu pago por un monto de {{2}} vence pronto.',
        placeholders: ['Nombre del Lead', 'Monto'],
      }
    ]
  }

  async parseWebhook(req: Request, rawBody: string): Promise<ParsedWebhookMessage[]> {
    try {
      const parsed = JSON.parse(rawBody)
      if (Array.isArray(parsed)) {
        return parsed.map((m: any) => ({
          messageId: m.messageId || `mock_msg_${Math.random().toString(36).substring(2, 11)}`,
          fromPhone: m.fromPhone || '',
          body: m.body || '',
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        }))
      }
      return []
    } catch {
      return []
    }
  }
}
