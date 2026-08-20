'use client'

import { useEffect, useState } from 'react'

export interface ConfigurableColumn {
  key: string
  label: string
  /** Visible la primera vez que alguien abre la tabla, antes de guardar preferencia propia. */
  defaultOn: boolean
  /** Además de defaultOn, visible por defecto en desarrollo (útil para columnas de depuración,
   * como el estado de sincronización) aunque en producción arranquen ocultas. */
  devOnly?: boolean
}

/**
 * Estado + persistencia para el selector de columnas configurables, común a
 * cualquier tabla de la app (Contactos, Negocios, Empresas, y las que se
 * agreguen). Usar junto con `<ColumnPicker />` para la UI.
 *
 * `storageKey` debe ser único por tabla (ej. 'contactsTable.visibleColumns')
 * para que cada una guarde su propia preferencia en localStorage sin pisar
 * la de las demás.
 */
export function useConfigurableColumns(
  storageKey: string,
  columns: readonly ConfigurableColumn[],
) {
  const isDev = process.env.NODE_ENV === 'development'
  const defaultVisible = columns
    .filter((col) => col.defaultOn || (col.devOnly && isDev))
    .map((col) => col.key)

  const [visible, setVisible] = useState<string[]>(defaultVisible)

  // Cargar preferencia guardada al montar -- si el usuario ya eligió algo
  // explícitamente, esa elección manda por sobre el default de entorno.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) setVisible(JSON.parse(stored))
    } catch {
      // Preferencia corrupta o inexistente: se queda en el default de arriba
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const toggleColumn = (key: string) => {
    const next = visible.includes(key)
      ? visible.filter((k) => k !== key)
      : [...visible, key]
    setVisible(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const isVisible = (key: string) => visible.includes(key)

  return { visible, isVisible, toggleColumn }
}
