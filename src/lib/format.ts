/**
 * Formateo de montos monetarios.
 *
 * La app opera siempre en guaraníes (PYG): sin decimales (no se usa la
 * fracción del guaraní en la práctica comercial) y con punto como
 * separador de miles, según la convención paraguaya (locale es-PY).
 *
 * Fuente: feedback de Negofin — "Fijar la moneda del dashboard siempre en
 * guaraníes" (ítem #22 del análisis de feedback del Portal de Vendedores).
 */
export function formatGs(amount: number | undefined | null): string {
  const rounded = Math.round(amount || 0)
  return `Gs. ${rounded.toLocaleString('es-PY')}`
}
