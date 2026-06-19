export interface SendMessageOptions {
  templateName?: string
  language?: string
  placeholders?: string[]
}

export interface SendMessageResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface ParsedWebhookMessage {
  messageId: string
  fromPhone: string
  body: string
  timestamp: Date
}

export interface IMessagingProvider {
  sendMessage(to: string, body: string, options?: SendMessageOptions): Promise<SendMessageResult>
  getTemplates?(): Promise<{ name: string; label: string; language: string; text: string; placeholders: string[] }[]>
  parseWebhook(req: Request, rawBody: string): Promise<ParsedWebhookMessage[]>
}
