import { useTranslation } from 'react-i18next'
import { SEO } from '@/components/SEO'
import { Contact } from '@/components/sections'

/** Contact standalone sayfası — section komponentini olduğu gibi yeniden
 * kullanır (HomePage'de de aynı Contact render edilir); sadece SEO ve üst
 * boşluk (section zaten kendi padding'ini taşıyor, header'ın altında kalmasın
 * diye pt-24 ekleniyor) sarmalanır. */
export function ContactPage() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title={`${t('contact.title')} | ${t('meta.title')}`}
        description={t('contact.subtitle')}
      />
      <div className="pt-24">
        <Contact />
      </div>
    </>
  )
}
