export interface Project {
  id: string
  slug: string
  title: {
    tr: string
    en: string
    ar: string
  }
  description: {
    tr: string
    en: string
    ar: string
  }
  category: 'amber' | 'kuka' | 'oltu' | 'other'
  cover: string
  images: string[]
  date: string
  featured?: boolean
}

export interface Testimonial {
  id: string
  name: string
  text: {
    tr: string
    en: string
    ar: string
  }
  avatar?: string
  rating?: number
}

export interface SiteConfig {
  name: string
  title: string
  description: string
  url: string
  email: string
  phone: string
  whatsapp: string
  instagram: string
  social: {
    instagram?: string
    whatsapp?: string
  }
}

export interface NavItem {
  key: string
  href: string
}
