import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Phone, Instagram, MessageCircle, Heart } from 'lucide-react'
import { navItems, siteConfig } from '@/content/config'

export function Footer() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-base-200 py-12 md:py-16">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <div>
            <Link
              to="/"
              className="text-2xl font-serif font-bold text-base-content hover:text-primary transition-colors"
            >
              {siteConfig.name}
            </Link>
            <p className="mt-4 text-base-content/70">
              {t('hero.description')}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">{t('nav.home')}</h3>
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.key}>
                  <Link
                    to={item.href}
                    className="text-base-content/70 hover:text-base-content transition-colors"
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">{t('contact.title')}</h3>
            <ul className="space-y-3">
              <li>
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="text-base-content/70 hover:text-base-content transition-colors flex items-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  {siteConfig.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${siteConfig.phone}`}
                  className="text-base-content/70 hover:text-base-content transition-colors flex items-center gap-2"
                >
                  <Phone className="w-5 h-5" />
                  {siteConfig.phone}
                </a>
              </li>
            </ul>

            <div className="flex items-center gap-2 mt-6">
              <a
                href={siteConfig.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm btn-square"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href={siteConfig.social.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm btn-square"
                aria-label="WhatsApp"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-base-300 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-base-content/60 text-sm">
            &copy; {currentYear} {siteConfig.name}. {t('footer.rights')}
          </p>
          <p className="text-base-content/60 text-sm flex items-center gap-1">
            {t('footer.madeWith')} <Heart className="w-4 h-4 text-error fill-current" />
          </p>
        </div>
      </div>
    </footer>
  )
}
