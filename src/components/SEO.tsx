import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { siteConfig } from '@/content/config'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article'
  noindex?: boolean
  /** Sayfaya özgü ek JSON-LD (örn. FAQPage, ItemList) — Person şemasına ek olarak basılır. */
  structuredDataExtra?: Record<string, unknown> | null
}

/** og:locale, dil kodunu değil bölgeli biçimi bekler (tr değil tr_TR). */
const OG_LOCALES: Record<string, string> = { tr: 'tr_TR', en: 'en_US', ar: 'ar_SA' }

export function SEO({
  title,
  description,
  image = '/og-default.jpg', // varsayılan paylaşım görseli: logo kartı (kişisel fotoğraf değil)
  url,
  type = 'website',
  noindex = false,
  structuredDataExtra = null,
}: SEOProps) {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()

  const seoTitle = title || t('meta.title')
  const seoDescription = description || t('meta.description')
  // Canonical her sayfada kendi yolunu göstermeli — hepsi ana sayfayı
  // gösterirse arama motoru alt sayfaları kopya sayar.
  const seoUrl = url || `${siteConfig.url}${pathname === '/' ? '' : pathname}`
  const seoImage = image.startsWith('http') ? image : `${siteConfig.url}${image}`
  const lang2 = (i18n.language || 'tr').slice(0, 2)
  const ogLocale = OG_LOCALES[lang2] ?? 'tr_TR'
  const ogAlternates = Object.values(OG_LOCALES).filter((l) => l !== ogLocale)

  // React does not hoist <html> attributes; set lang/dir imperatively.
  useEffect(() => {
    document.documentElement.lang = i18n.language
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr'
  }, [i18n.language])

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: siteConfig.name,
    url: siteConfig.url,
    email: siteConfig.email,
    telephone: siteConfig.phone,
    jobTitle: t('hero.title'),
    description: seoDescription,
    image: seoImage,
    sameAs: [siteConfig.social.instagram, siteConfig.social.whatsapp].filter(Boolean),
  }

  return (
    <>
      <title>{seoTitle}</title>
      <meta name="description" content={seoDescription} />
      <meta name="keywords" content={t('meta.keywords')} />
      <link rel="canonical" href={seoUrl} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:image" content={seoImage} />
      <meta property="og:url" content={seoUrl} />
      <meta property="og:site_name" content={siteConfig.name} />
      <meta property="og:locale" content={ogLocale} />
      {ogAlternates.map((l) => (
        <meta key={l} property="og:locale:alternate" content={l} />
      ))}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      <meta name="twitter:image" content={seoImage} />

      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      {structuredDataExtra && (
        <script type="application/ld+json">{JSON.stringify(structuredDataExtra)}</script>
      )}
    </>
  )
}
