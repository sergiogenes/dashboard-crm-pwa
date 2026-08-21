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

/**
 * Formateo compacto en millones de guaraníes, para KPIs/tarjetas resumen
 * donde importa poder leer el número de un vistazo (ej. "Gs. 5,50M") en vez
 * del monto completo. Siempre en millones, con 2 decimales fijos — incluso
 * para montos menores a 1.000.000 (ej. "Gs. 0,02M") para no perder toda
 * precisión en ese caso, aunque en la práctica el acumulado de un KPI rara
 * vez baja de esa magnitud.
 *
 * Usar SOLO para KPIs/resúmenes agregados — el detalle por registro (tabla
 * de deals, filas de vendedor, drawer de contacto) debe seguir mostrando el
 * monto completo vía `formatGs`, donde la precisión exacta importa.
 */
export function formatGsCompact(amount: number | undefined | null): string {
  const millions = (amount || 0) / 1_000_000
  return `Gs. ${millions.toLocaleString('es-PY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}M`
}
