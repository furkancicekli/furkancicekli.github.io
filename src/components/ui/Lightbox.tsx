import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface LightboxItem {
  type: 'image' | 'video'
  src: string
  alt?: string
}

interface LightboxProps {
  items: LightboxItem[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

/**
 * Full-screen lightbox shared by the main product gallery and the process
 * section — one overlay implementation (X/Escape/backdrop close, ‹ ›
 * navigation via click or arrow keys, body scroll lock) driven purely by
 * an item list + current index so callers stay thin.
 */
export function Lightbox({ items, index, onClose, onNavigate }: LightboxProps) {
  const { t } = useTranslation()
  const item = items[index]
  const canNavigate = items.length > 1

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && canNavigate) onNavigate((index + 1) % items.length)
      if (e.key === 'ArrowLeft' && canNavigate) onNavigate((index - 1 + items.length) % items.length)
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, onNavigate, index, items.length, canNavigate])

  if (!item) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative max-w-[92vw] md:max-w-4xl"
          onClick={(e) => e.stopPropagation()}
        >
          {item.type === 'video' ? (
            <video
              src={item.src}
              controls
              playsInline
              autoPlay
              className="block w-auto max-w-full max-h-[85vh] object-contain rounded-lg mx-auto"
            />
          ) : (
            <img
              src={item.src}
              alt={item.alt ?? ''}
              className="block w-auto max-w-full max-h-[85vh] object-contain rounded-lg mx-auto"
            />
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label={t('a11y.close')}
            className={cn(
              buttonVariants({ size: 'icon' }),
              'absolute top-4 right-4 rounded-full bg-background/90 text-foreground hover:bg-background hover:text-foreground shadow-md',
            )}
          >
            <X className="w-5 h-5" />
          </button>

          {canNavigate && (
            <>
              <button
                type="button"
                onClick={() => onNavigate((index - 1 + items.length) % items.length)}
                aria-label={t('a11y.prevImage')}
                className={cn(
                  buttonVariants({ size: 'icon' }),
                  'absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 text-foreground hover:bg-background hover:text-foreground shadow-md',
                )}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate((index + 1) % items.length)}
                aria-label={t('a11y.nextImage')}
                className={cn(
                  buttonVariants({ size: 'icon' }),
                  'absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 text-foreground hover:bg-background hover:text-foreground shadow-md',
                )}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
