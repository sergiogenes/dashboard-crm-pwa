'use client'

import { AlertTriangle, HelpCircle } from 'lucide-react'

export interface ConfirmDialogOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' para acciones destructivas (eliminar); 'default' para el resto. */
  variant?: 'default' | 'danger'
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Diálogo de confirmación con el mismo estilo visual que los modales de
 * Lead/Empresa (Paleta B — solo tokens semánticos, sin colores literales).
 * No se renderiza directamente: se usa a través del hook `useConfirm()`.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const Icon = variant === 'danger' ? AlertTriangle : HelpCircle

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* A diferencia de los modales de formulario, aquí no hay datos que
          perder — un clic afuera equivale a "Cancelar". */}
      <div
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="animate-in fade-in zoom-in-95 relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl duration-200">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-xl p-2.5 ${
                variant === 'danger'
                  ? 'bg-bad-bg text-bad'
                  : 'bg-chip text-chip-ink'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">{title}</h3>
              <p className="mt-1 text-xs text-ink-2">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-surface-2/50 px-6 py-4">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-2"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              variant === 'danger'
                ? 'bg-bad-bg text-bad hover:bg-bad-bd/40'
                : 'bg-cta-bg text-cta-ink hover:bg-accent'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
