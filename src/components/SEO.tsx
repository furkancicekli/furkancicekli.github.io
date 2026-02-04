import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { siteConfig } from '@/content/config'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article'
  noindex?: boolean
}

export function SEO({
  title,
  description,
  image = '/images/hero/1.jpeg',
  url,
  type = 'website',
  noindex = false,
}: SEOProps) {
  const { t, i18n } = useTranslation()

  const seoTitle = title || t('meta.title')
  const seoDescription = description || t('meta.description')
  const seoUrl = url || siteConfig.url
  const seoImage = image.startsWith('http') ? image : `${siteConfig.url}${image}`

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
    sameAs: [
      siteConfig.social.instagram,
      siteConfig.social.whatsapp,
    ].filter(Boolean),
  }

  return (
    <Helmet>
      <html lang={i18n.language} dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} />
      <title>{seoTitle}</title>
      <meta name="description" content={seoDescription} />
      <meta name="keywords" content={t('meta.keywords')} />
      <link rel="canonical" href={seoUrl} />

      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:image" content={seoImage} />
      <meta property="og:url" content={seoUrl} />
      <meta property="og:site_name" content={siteConfig.name} />
      <meta property="og:locale" content={i18n.language} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      <meta name="twitter:image" content={seoImage} />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  )
}
