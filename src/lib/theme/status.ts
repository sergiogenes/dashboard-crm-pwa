/**
 * Helpers centralizados de color por estado/semántica.
 *
 * Antes de este módulo, cada componente (DealTable, DealCard, LeadDrawer,
 * contacts/page.tsx, SyncStatusBadge) reimplementaba su propia lógica de
 * color por estado, con inconsistencias (rojo vs. rosa para "peligro", azul
 * vs. índigo para "info/nuevo"). Este módulo es la única fuente de verdad:
 * usa siempre los tokens semánticos definidos en src/app/globals.css
 * (ok/warn/bad/info/chip/accent...), nunca un color de Tailwind literal.
 *
 * Un futuro cambio de paleta no debería requerir tocar este archivo — solo
 * los valores de :root en globals.css. Este módulo solo mapea SIGNIFICADO
 * (aprobado, rechazado, sincronizando...) a TOKEN (ok, bad, info...).
 */
import type { LucideIcon } from 'lucide-react'
import {
  Phone,
  Calendar,
  Mail,
  CheckSquare,
  MessageCircle,
  MessageSquare,
} from 'lucide-react'
import type { LocalDeal, LocalActivity } from '@/lib/db'

/** Clases "badge suave" (fondo tenue + borde + texto) por token semántico. */
export const BADGE = {
  neutral: 'border-border-2 bg-surface-2 text-ink-2',
  info: 'border-chip-bd bg-chip text-chip-ink',
  ok: 'border-ok-bd bg-ok-bg text-ok',
  warn: 'border-warn-bd bg-warn-bg text-warn',
  bad: 'border-bad-bd bg-bad-bg text-bad',
  /** Texto en el verde oscuro por defecto (--ink), sin tinte semántico. Se
   * usa donde se pidió reservar el color solo para la única señal que
   * realmente importa (ej. En Mora en la pantalla de Negocios), dejando
   * todo lo demás "neutral" con el color de texto estándar de la app. */
  default: 'border-border bg-surface-2 text-ink',
} as const

// ---------------------------------------------------------------------------
// Etapas de préstamos (Deals)
// ---------------------------------------------------------------------------

export function getDealStageConfig(stage: LocalDeal['stage']): { label: string; style: string } {
  switch (stage) {
    case 'draft':
      return { label: 'Borrador', style: BADGE.default }
    case 'under_evaluation':
      return { label: 'Evaluación', style: BADGE.default }
    case 'approved':
      return { label: 'Aprobado', style: BADGE.default }
    case 'disbursed':
      return { label: 'Desembolsado', style: BADGE.default }
    case 'completed':
      return { label: 'Completado', style: BADGE.default }
    case 'refused':
      return { label: 'Rechazado', style: BADGE.default }
    case 'overdue':
      return { label: 'En Mora', style: `${BADGE.bad} font-bold animate-pulse` }
    default:
      return { label: stage, style: BADGE.default }
  }
}

/** Estilo del stepper horizontal de progreso de un Deal (LeadDrawer). */
export function getDealStepStyle(status: 'completed' | 'active' | 'upcoming' | 'disabled'): {
  circle: string
  label: string
} {
  switch (status) {
    case 'completed':
      return { circle: 'border-ok bg-ok text-white', label: 'text-ok' }
    case 'active':
      return { circle: 'border-primary bg-ok-bg text-primary ring-2 ring-primary/20', label: 'font-bold text-primary' }
    case 'disabled':
      return { circle: 'border-border-2 bg-surface-2 text-ink-3', label: 'text-ink-3' }
    default:
      return { circle: 'border-border-2 bg-surface text-ink-3', label: 'text-ink-3' }
  }
}

// ---------------------------------------------------------------------------
// Scoring crediticio (A+..F)
// ---------------------------------------------------------------------------

const SCORING_TIER_STYLE: Record<string, string> = {
  'A+': BADGE.ok,
  A: BADGE.ok,
  B: BADGE.ok,
  C: BADGE.warn,
  D: BADGE.warn,
  E: BADGE.bad,
  F: BADGE.bad,
}

const SCORING_TIER_DESC: Record<string, string> = {
  'A+': 'Excelente',
  A: 'Excelente',
  B: 'Excelente',
  C: 'Riesgo Medio',
  D: 'Riesgo Medio',
  E: 'Riesgo Alto',
  F: 'Riesgo Alto',
}

/**
 * variant 'compact': solo la letra (para tablas/cards). variant 'full':
 * etiqueta descriptiva completa (para el detalle del drawer).
 */
export function getScoringBadge(
  scoring: string | undefined,
  variant: 'compact' | 'full' = 'compact'
): { label: string; style: string } {
  const style = (scoring && SCORING_TIER_STYLE[scoring]) || BADGE.neutral

  if (!scoring) {
    return { label: variant === 'full' ? 'Sin Score' : '-', style }
  }
  if (variant === 'full') {
    return { label: `Score ${scoring} (${SCORING_TIER_DESC[scoring] ?? 'Sin clasificar'})`, style }
  }
  return { label: scoring, style }
}

// ---------------------------------------------------------------------------
// Estado de un Lead en el embudo (Nuevo / En Proceso / Aprobado / Rechazado / Ajeno)
// ---------------------------------------------------------------------------

export type LeadStatusValue = 'Aprobado' | 'En Proceso' | 'Rechazado' | 'Nuevo' | 'Cargando...' | 'Ajeno'

export function getLeadStatusBadge(status: LeadStatusValue): { label: string; style: string } {
  switch (status) {
    case 'Aprobado':
      return { label: 'Aprobado', style: BADGE.ok }
    case 'En Proceso':
      return { label: 'En Proceso', style: BADGE.warn }
    case 'Rechazado':
      return { label: 'Rechazado', style: BADGE.bad }
    case 'Nuevo':
      return { label: 'Nuevo', style: BADGE.info }
    case 'Cargando...':
      return { label: 'Cargando...', style: `${BADGE.neutral} animate-pulse` }
    default: // 'Ajeno' — no es un estado del embudo, es un marcador de propiedad
      return { label: 'Ajeno', style: 'border-border bg-surface-2 text-accent' }
  }
}

// ---------------------------------------------------------------------------
// Estado de sincronización (SyncStatusBadge)
// ---------------------------------------------------------------------------

export type SyncUiState = 'offline' | 'syncing' | 'error' | 'pending' | 'synced'

export const SYNC_STATUS_STYLES: Record<SyncUiState, { container: string; icon: string }> = {
  offline: { container: 'border-border bg-surface-2 text-ink-2', icon: 'text-ink-3' },
  syncing: { container: BADGE.info, icon: 'text-info' },
  error: { container: BADGE.bad, icon: 'text-bad' },
  pending: { container: `${BADGE.warn} animate-pulse`, icon: 'text-warn' },
  synced: { container: BADGE.ok, icon: 'text-ok' },
}

// ---------------------------------------------------------------------------
// Tipo de actividad en el timeline (LeadDrawer)
// ---------------------------------------------------------------------------

export function getActivityTypeConfig(type: LocalActivity['type']): { icon: LucideIcon; style: string } {
  switch (type) {
    case 'CALL':
      return { icon: Phone, style: BADGE.info }
    case 'MEETING':
      // Paleta B no tiene un tono morado equivalente al de la paleta anterior;
      // se usa el acento de marca como color categórico (no es un estado semántico).
      return { icon: Calendar, style: 'border-border bg-surface-2 text-accent' }
    case 'EMAIL':
      return { icon: Mail, style: BADGE.warn }
    case 'TASK':
      return { icon: CheckSquare, style: BADGE.bad }
    case 'WHATSAPP':
      return { icon: MessageCircle, style: BADGE.ok }
    case 'NOTE':
    default:
      return { icon: MessageSquare, style: BADGE.ok }
  }
}
