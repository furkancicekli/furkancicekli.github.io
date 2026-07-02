import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (result: boolean) => void
}

/**
 * Tarayıcının window.confirm'i yerine uygulama içi onay modal'ı.
 * Kullanım:
 *   const { confirm, confirmDialog } = useConfirm()
 *   ...
 *   if (!(await confirm({ message: 'Silinecek. Emin misin?' }))) return
 *   ...
 *   return <div>...{confirmDialog}</div>   // sayfanın köküne bir kez eklenir
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve })
      }),
    [],
  )

  const close = useCallback(
    (result: boolean) => {
      setPending((current) => {
        current?.resolve(result)
        return null
      })
    },
    [],
  )

  const confirmDialog: ReactNode = pending ? <ConfirmDialog pending={pending} onClose={close} /> : null

  return { confirm, confirmDialog }
}

// eslint-disable-next-line react-refresh/only-export-components -- hook + iç modal bileşeni bilinçli olarak tek dosyada
function ConfirmDialog({ pending, onClose }: { pending: PendingConfirm; onClose: (result: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Açılınca odak Vazgeç'te başlasın; Escape kapatsın
  useEffect(() => {
    cancelRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      onClick={() => onClose(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="confirm-title" className="font-serif text-lg font-bold">
          {pending.title ?? 'Emin misin?'}
        </h2>
        <p id="confirm-message" className="mt-2 text-sm text-muted-foreground">
          {pending.message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            {pending.cancelLabel ?? 'Vazgeç'}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground outline-none transition-colors hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {pending.confirmLabel ?? 'Sil'}
          </button>
        </div>
      </div>
    </div>
  )
}
