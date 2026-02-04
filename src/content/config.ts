import type { SiteConfig, NavItem } from '@/types'

export const siteConfig: SiteConfig = {
  name: 'Furkan Çiçekli',
  title: 'Furkan Çiçekli | Tesbih Ustası',
  description: 'El yapımı tesbihlerin ustası. 6 yıllık tecrübe ile geleneksel ve modern tasarımlar.',
  url: 'https://furkancicekli.com',
  email: 'furkancicekli@outlook.com',
  phone: '+905543875991',
  whatsapp: '+905543875991',
  instagram: 'furkan.cicekli_',
  social: {
    instagram: 'https://instagram.com/furkan.cicekli_',
    whatsapp: 'https://wa.me/905543875991',
  },
}

export const navItems: NavItem[] = [
  { key: 'home', href: '/' },
  { key: 'about', href: '/#about' },
  { key: 'gallery', href: '/gallery' },
  { key: 'contact', href: '/#contact' },
]

export const stats = [
  { value: 6, key: 'experience' },
  { value: 100, key: 'projects', suffix: '+' },
  { value: 2, key: 'kuwait' },
]
