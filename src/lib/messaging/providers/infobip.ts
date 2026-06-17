import { IMessagingProvider, SendMessageOptions, SendMessageResult } from '../interface'

interface InfobipConfig {
  apiKey: string
  baseUrl: string
  senderNumber: string
}

export class InfobipMessagingProvider implements IMessagingProvider {
  private apiKey: string
  private baseUrl: string
  private senderNumber: string

  constructor(config: InfobipConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    this.senderNumber = config.senderNumber
  }

  async sendMessage(
    to: string,
    body: string,
    options?: SendMessageOptions,
  ): Promise<SendMessageResult> {
    try {
      // Formatear el número (debe ser internacional puro, sin espacios ni signos "+")
      const formattedTo = to.replace(/[+\s-]/g, '')

      let endpoint = '/whatsapp/1/message/text'
      let requestBody: any = {}

      if (options?.templateName) {
        endpoint = '/whatsapp/1/message/template'
        requestBody = {
          messages: [
            {
              from: this.senderNumber,
              to: formattedTo,
              content: {
                templateName: options.templateName,
                templateData: {
                  body: {
                    placeholders: options.placeholders || [],
                  },
                },
                language: options.language || 'es',
              },
            }
          ]
        }
      } else {
        requestBody = {
          from: this.senderNumber,
          to: formattedTo,
          content: {
            text: body,
          },
        }
      }

      let cleanBaseUrl = this.baseUrl.replace(/\/+$/, '')
      if (!/^https?:\/\//i.test(cleanBaseUrl)) {
        cleanBaseUrl = `https://${cleanBaseUrl}`
      }
      const url = `${cleanBaseUrl}${endpoint}`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `App ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `Infobip API Error (${response.status}): ${errorText}`,
        }
      }

      const data = await response.json()
      console.log('[Infobip API Response Details]:', JSON.stringify(data, null, 2))
      const messageId = data.messages?.[0]?.messageId || `ib_msg_${Math.random().toString(36).substring(2, 9)}`

      return {
        success: true,
        messageId,
      }
    } catch (err: any) {
      console.error('[Infobip Provider] Error al enviar mensaje:', err)
      return {
        success: false,
        error: err.message || 'Error de red desconocido',
      }
    }
  }

  async getTemplates() {
    try {
      let cleanBaseUrl = this.baseUrl.replace(/\/+$/, '')
      if (!/^https?:\/\//i.test(cleanBaseUrl)) {
        cleanBaseUrl = `https://${cleanBaseUrl}`
      }
      const url = `${cleanBaseUrl}/whatsapp/2/senders/${this.senderNumber}/templates`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `App ${this.apiKey}`,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Infobip Provider] Error al obtener plantillas (${response.status}):`, errorText)
        return []
      }

      const data = await response.json()
      const rawTemplates = data.templates || []

      // Filtrar plantillas que estén APPROVED y que sean de tipo TEXTO (para evitar errores 7009)
      const approvedTextTemplates = rawTemplates.filter((item: any) => {
        return item.status === 'APPROVED' && item.structure?.type === 'TEXT'
      })

      return approvedTextTemplates.map((item: any) => {
        const text = item.structure?.body?.text || item.structure?.body || ''
        // Detectar placeholders del tipo {{1}}, {{2}}...
        const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)]
        const placeholderIndices = matches.map(m => parseInt(m[1], 10))
        const numVariables = placeholderIndices.length > 0 ? Math.max(...placeholderIndices) : 0
        const placeholders = Array.from({ length: numVariables }, (_, i) => `Variable ${i + 1}`)

        return {
          name: item.name,
          label: `${item.name} (${item.language}) - Texto plano`,
          language: item.language,
          text,
          placeholders,
        }
      })
    } catch (err) {
      console.error('[Infobip Provider] Error al obtener plantillas:', err)
      return []
    }
  }
}
