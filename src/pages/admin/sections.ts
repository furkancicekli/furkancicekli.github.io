/**
 * Admin panel bölüm haritası — sidebar navigasyonu ve Genel Bakış kartları
 * aynı listeden beslenir. `ready: false` olan bölümler rotaya sahiptir ama
 * "yakında" sayfası gösterir (Faz 3 / Faz 5'te içerik yönetimi eklenecek).
 */
import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, Package, MessageCircleQuestion, BadgeCheck, Settings } from 'lucide-react'

export interface AdminSection {
  path: string
  label: string
  description: string
  icon: LucideIcon
  ready: boolean
}

export const overviewSection: AdminSection = {
  path: '/admin',
  label: 'Genel Bakış',
  description: 'Panelin özeti ve kısayollar.',
  icon: LayoutGrid,
  ready: true,
}

export const contentSections: AdminSection[] = [
  {
    path: '/admin/products',
    label: 'Ürünler',
    description: 'Ürün ekleme, fotoğraf ve video yönetimi.',
    icon: Package,
    ready: true,
  },
  {
    path: '/admin/faq',
    label: 'SSS',
    description: 'Sıkça sorulan soruların yönetimi.',
    icon: MessageCircleQuestion,
    ready: true,
  },
  {
    path: '/admin/certificates',
    label: 'Sertifikalar',
    description: 'Satılan ürünler için sertifika ve QR kodu üretimi.',
    icon: BadgeCheck,
    ready: true,
  },
]

export const settingsSection: AdminSection = {
  path: '/admin/settings',
  label: 'Ayarlar',
  description: 'Hesap ve şifre yönetimi.',
  icon: Settings,
  ready: true,
}

/** Sidebar sırası: genel bakış → içerik bölümleri → ayarlar */
export const allSections: AdminSection[] = [overviewSection, ...contentSections, settingsSection]
