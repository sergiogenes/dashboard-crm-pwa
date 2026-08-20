'use client'

import { useEffect, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import { ConfigurableColumn } from '@/hooks/useConfigurableColumns'

interface ColumnPickerProps {
  columns: readonly ConfigurableColumn[]
  isVisible: (key: string) => boolean
  onToggle: (key: string) => void
}

/**
 * Ícono de engranaje + dropdown para elegir qué columnas mostrar en una
 * tabla. Se usa junto con `useConfigurableColumns()` -- pensado para ir
 * dentro del header de la columna "Acciones" (ver LeadTable.tsx como
 * referencia), pero funciona en cualquier posición.
 */
export default function ColumnPicker({
  columns,
  isVisible,
  onToggle,
}: ColumnPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg p-1 normal-case text-ink-3 transition-colors hover:bg-surface hover:text-ink"
        title="Configurar columnas"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-border bg-surface p-2 text-left shadow-2xl">
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Mostrar columnas
          </p>
          {columns.map((col) => (
            <label
              key={col.key}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-normal normal-case text-ink-2 transition-colors hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={isVisible(col.key)}
                onChange={() => onToggle(col.key)}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
