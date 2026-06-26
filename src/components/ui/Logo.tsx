/**
 * Logo — renders FURKANLOGO.png as a CSS mask-image on a <span>.
 *
 * The mask technique paints the span's backgroundColor through the alpha
 * channel of the PNG silhouette, so the visible color is always driven by
 * the Tailwind `text-*` class you pass (backgroundColor: 'currentColor').
 *
 * Usage:
 *   <Logo className="h-10 w-[21px] text-foreground" />        // navbar
 *   <Logo className="h-10 w-[21px] text-neutral-content" />   // footer
 *   <Logo decorative className="h-24 w-[62px] text-foreground" /> // no aria
 *
 * The image is 2030×3960 (aspect ≈ 0.5126 wide per unit tall).
 * Convenient shorthand: for any height h, set width ≈ h × 0.5126.
 *   h-10 (40px)  → w-[21px]
 *   h-12 (48px)  → w-[25px]
 *   h-24 (96px)  → w-[49px]
 * Or use aspect-[2030/3960] with a fixed height if Tailwind resolves it.
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  /** When true, renders aria-hidden and omits role/aria-label (decorative use). */
  decorative?: boolean
}

export function Logo({ className, decorative = false }: LogoProps) {
  const { t } = useTranslation()

  const maskStyle: React.CSSProperties = {
    maskImage: 'url(/FURKANLOGO.png)',
    WebkitMaskImage: 'url(/FURKANLOGO.png)',
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
    backgroundColor: 'currentColor',
    display: 'inline-block',
  }

  if (decorative) {
    return (
      <span
        aria-hidden="true"
        style={maskStyle}
        className={cn(className)}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={t('a11y.logo')}
      style={maskStyle}
      className={cn(className)}
    />
  )
}
