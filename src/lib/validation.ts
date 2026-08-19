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
