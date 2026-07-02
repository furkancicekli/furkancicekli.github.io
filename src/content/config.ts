import type { SiteConfig, NavItem } from '@/types'

export const siteConfig: SiteConfig = {
  name: 'Furkan Çiçekli',
  title: 'Furkan Çiçekli | Tesbih Ustası',
  description: 'El yapımı tesbihlerin ustası. 6 yıllık tecrübe ile geleneksel ve modern tasarımlar.',
  url: 'https://furkancicekli.com',
  email: 'furkancicekli@outlook.com',
  phone: '+905543875991',
  whatsapp: '+905543875991',
  instagram: 'furkanciceklitesbih',
  social: {
    instagram: 'https://instagram.com/furkanciceklitesbih',
    whatsapp: 'https://wa.me/905543875991',
  },
}

export const navItems: NavItem[] = [
  { key: 'home', href: '/' },
  { key: 'products', href: '/products' },
  { key: 'gallery', href: '/gallery' },
  { key: 'faq', href: '/faq' },
  { key: 'contact', href: '/contact' },
  { key: 'verify', href: '/verify' },
]
