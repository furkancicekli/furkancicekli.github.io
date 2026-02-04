import type { Project } from '@/types'

export const projects: Project[] = [
  {
    id: '1',
    slug: 'el-isi-1',
    title: {
      tr: 'El İşi Tesbih',
      en: 'Handmade Prayer Beads',
      ar: 'مسبحة يدوية',
    },
    description: {
      tr: 'El işçiliği ile özenle hazırlanmış tesbih. Her tanesi özenle seçilmiş ve işlenmiştir.',
      en: 'Carefully handcrafted prayer beads. Each bead is meticulously selected and crafted.',
      ar: 'مسبحة مصنوعة يدويًا بعناية. كل حبة مختارة ومصنوعة بدقة.',
    },
    category: 'amber',
    cover: '/images/gallery/craft-1.jpg',
    images: ['/images/gallery/craft-1.jpg'],
    date: '2024-01-15',
    featured: true,
  },
  {
    id: '2',
    slug: 'el-isi-2',
    title: {
      tr: 'Özel Tasarım Tesbih',
      en: 'Custom Design Prayer Beads',
      ar: 'مسبحة بتصميم خاص',
    },
    description: {
      tr: 'Geleneksel yöntemlerle üretilmiş otantik tesbih.',
      en: 'Authentic prayer beads made with traditional methods.',
      ar: 'مسبحة أصيلة مصنوعة بالطرق التقليدية.',
    },
    category: 'kuka',
    cover: '/images/gallery/craft-2.jpg',
    images: ['/images/gallery/craft-2.jpg'],
    date: '2024-01-10',
    featured: true,
  },
  {
    id: '3',
    slug: 'el-isi-3',
    title: {
      tr: 'Koleksiyon Tesbih',
      en: 'Collection Prayer Beads',
      ar: 'مسبحة للمجموعة',
    },
    description: {
      tr: 'Koleksiyonluk değerinde özel tesbih.',
      en: 'Special prayer beads of collection value.',
      ar: 'مسبحة خاصة ذات قيمة للمجموعة.',
    },
    category: 'oltu',
    cover: '/images/gallery/craft-3.jpg',
    images: ['/images/gallery/craft-3.jpg'],
    date: '2024-01-05',
    featured: true,
  },
  {
    id: '4',
    slug: 'el-isi-4',
    title: {
      tr: 'Kehribar Tesbih',
      en: 'Amber Prayer Beads',
      ar: 'مسبحة كهرمان',
    },
    description: {
      tr: 'Doğal kehribar tanelerinden oluşan zarif tesbih.',
      en: 'Elegant prayer beads made from natural amber beads.',
      ar: 'مسبحة أنيقة مصنوعة من حبات الكهرمان الطبيعي.',
    },
    category: 'amber',
    cover: '/images/gallery/craft-4.jpg',
    images: ['/images/gallery/craft-4.jpg'],
    date: '2023-12-20',
  },
  {
    id: '5',
    slug: 'el-isi-5',
    title: {
      tr: 'Özel Sipariş',
      en: 'Custom Order',
      ar: 'طلب خاص',
    },
    description: {
      tr: 'Müşteri isteğine göre özel olarak tasarlanmış tesbih.',
      en: 'Prayer beads specially designed according to customer request.',
      ar: 'مسبحة مصممة خصيصًا وفقًا لطلب العميل.',
    },
    category: 'other',
    cover: '/images/gallery/craft-5.jpg',
    images: ['/images/gallery/craft-5.jpg'],
    date: '2023-12-15',
  },
  {
    id: '6',
    slug: 'el-isi-6',
    title: {
      tr: 'Nadir Tesbih',
      en: 'Rare Prayer Beads',
      ar: 'مسبحة نادرة',
    },
    description: {
      tr: 'Koleksiyonluk değerinde nadir tesbih.',
      en: 'Rare prayer beads of collection value.',
      ar: 'مسبحة نادرة ذات قيمة للمجموعة.',
    },
    category: 'amber',
    cover: '/images/gallery/craft-6.jpg',
    images: ['/images/gallery/craft-6.jpg'],
    date: '2023-12-10',
  },
]

export const getProject = (slug: string): Project | undefined => {
  return projects.find((p) => p.slug === slug)
}

export const getFeaturedProjects = (): Project[] => {
  return projects.filter((p) => p.featured)
}

export const getProjectsByCategory = (category: string): Project[] => {
  if (category === 'all') return projects
  return projects.filter((p) => p.category === category)
}
