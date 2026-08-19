'use client'

import { useCallback, useRef, useState } from 'react'
import ConfirmDialog, {
  ConfirmDialogOptions,
} from '@/components/ConfirmDialog'

/**
 * Reemplazo de `window.confirm()` con el estilo visual de la app.
 *
 * Uso:
 *   const { confirm, ConfirmDialogElement } = useConfirm()
 *   const ok = await confirm({ title: '...', message: '...', variant: 'danger' })
 *   if (!ok) return
 *   ...
 * y renderizar `{ConfirmDialogElement}` una vez en el JSX del componente.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmDialogOptions) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const settle = (result: boolean) => {
    setOptions(null)
    resolveRef.current?.(result)
    resolveRef.current = null
  }

  const ConfirmDialogElement = options ? (
    <ConfirmDialog
      {...options}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null

  return { confirm, ConfirmDialogElement }
}
