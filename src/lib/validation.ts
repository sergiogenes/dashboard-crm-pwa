import { parsePhoneNumberFromString } from 'libphonenumber-js'

/**
 * Valida un número de teléfono. Acepta el formato internacional completo con
 * "+" (ej. "+54 9 11 1234-5678" para Argentina, "+55 11 98765-4321" para
 * Brasil) o, si no se indica código de país, asume Paraguay (ej.
 * "0981 123456"). El "+" es siempre opcional — libphonenumber-js resuelve
 * automáticamente si el número trae su propio código de país o si hay que
 * interpretarlo con el país por defecto.
 *
 * El teléfono es un campo opcional en el formulario: una cadena vacía se
 * considera válida (nada que validar); solo se rechaza si hay contenido y
 * ese contenido no resuelve a un número real.
 */
export function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim()
  if (!trimmed) return true

  const parsed = parsePhoneNumberFromString(trimmed, 'PY')
  return parsed?.isValid() ?? false
}

/**
 * Sanea la entrada de un input de teléfono mientras se tipea: conserva
 * dígitos, espacios, guiones y paréntesis (formato legible), y permite un
 * único "+" al comienzo (prefijo de código de país). Cualquier otro
 * carácter, o un "+" que no esté en la primera posición, se descarta.
 */
export function sanitizePhoneInput(raw: string): string {
  const withoutInvalidChars = raw.replace(/[^\d\s()+-]/g, '')
  return withoutInvalidChars.replace(/(?!^)\+/g, '')
}

/**
 * Valida el formato de un email con el mismo patrón que usan los navegadores
 * para <input type="email"> (spec WHATWG) — cubre los casos reales sin la
 * rigidez excesiva de intentar seguir la RFC 5322 al pie de la letra (que la
 * propia spec de HTML recomienda no hacer). Sirve como refuerzo a nivel JS
 * de la validación nativa del navegador, que puede bypassearse.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

/**
 * Valida la Cédula de Identidad Civil paraguaya con lo único que se puede
 * verificar con rigor: solo dígitos, en un rango de longitud razonable.
 *
 * A diferencia del RUC (que sí tiene un dígito verificador módulo 11), la
 * cédula personal es un número puramente secuencial sin estructura interna
 * ni checksum publicado oficialmente (confirmado 19/8/2026, ver ítem #7 del
 * feedback de Negofín). Al día de hoy ya se expidieron más de 8.000.000 de
 * cédulas, así que las más recientes tienen 7-8 dígitos; cédulas antiguas
 * (emitidas hace décadas) pueden tener bastantes menos. El rango 5-9 es un
 * supuesto razonable, no una spec oficial confirmada por Negofín todavía.
 */
export function isValidParaguayanDocumentId(documentId: string): boolean {
  const trimmed = documentId.trim()
  if (!trimmed) return false
  return /^\d{5,9}$/.test(trimmed)
}
