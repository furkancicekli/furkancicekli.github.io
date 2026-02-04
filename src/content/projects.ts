import type { Project } from '@/types'

export const projects: Project[] = [
  {
    id: '1',
    slug: 'kehribar-tesbih-1',
    title: {
      tr: 'Kehribar Tesbih',
      en: 'Amber Prayer Beads',
      ar: 'مسبحة كهرمان',
    },
    description: {
      tr: 'El işçiliği ile özenle hazırlanmış kehribar tesbih. Her tanesi özenle seçilmiş ve işlenmiştir.',
      en: 'Carefully handcrafted amber prayer beads. Each bead is meticulously selected and crafted.',
      ar: 'مسبحة كهرمان مصنوعة يدويًا بعناية. كل حبة مختارة ومصنوعة بدقة.',
    },
    category: 'amber',
    cover: '/images/gallery/1.jpeg',
    images: ['/images/gallery/1.jpeg'],
    date: '2024-01-15',
    featured: true,
  },
  {
    id: '2',
    slug: 'kuka-tesbih-1',
    title: {
      tr: 'Kuka Tesbih',
      en: 'Kuka Prayer Beads',
      ar: 'مسبحة كوكا',
    },
    description: {
      tr: 'Geleneksel kuka ağacından üretilmiş otantik tesbih.',
      en: 'Authentic prayer beads made from traditional kuka wood.',
      ar: 'مسبحة أصيلة مصنوعة من خشب الكوكا التقليدي.',
    },
    category: 'kuka',
    cover: '/images/gallery/2.jpeg',
    images: ['/images/gallery/2.jpeg'],
    date: '2024-01-10',
    featured: true,
  },
  {
    id: '3',
    slug: 'oltu-tasi-tesbih',
    title: {
      tr: 'Oltu Taşı Tesbih',
      en: 'Jet Stone Prayer Beads',
      ar: 'مسبحة حجر الأولتو',
    },
    description: {
      tr: 'Erzurum oltu taşından el yapımı özel tesbih.',
      en: 'Handmade special prayer beads from Erzurum jet stone.',
      ar: 'مسبحة خاصة مصنوعة يدويًا من حجر الأولتو الأرضرومي.',
    },
    category: 'oltu',
    cover: '/images/gallery/3.jpeg',
    images: ['/images/gallery/3.jpeg'],
    date: '2024-01-05',
    featured: true,
  },
  {
    id: '4',
    slug: 'kehribar-tesbih-2',
    title: {
      tr: 'Damla Kehribar',
      en: 'Drop Amber',
      ar: 'كهرمان قطرة',
    },
    description: {
      tr: 'Damla formunda kehribar tanelerinden oluşan zarif tesbih.',
      en: 'Elegant prayer beads made from drop-shaped amber beads.',
      ar: 'مسبحة أنيقة مصنوعة من حبات كهرمان على شكل قطرة.',
    },
    category: 'amber',
    cover: '/images/gallery/4.jpeg',
    images: ['/images/gallery/4.jpeg'],
    date: '2023-12-20',
  },
  {
    id: '5',
    slug: 'ozel-tasarim-1',
    title: {
      tr: 'Özel Tasarım',
      en: 'Custom Design',
      ar: 'تصميم خاص',
    },
    description: {
      tr: 'Müşteri isteğine göre özel olarak tasarlanmış tesbih.',
      en: 'Prayer beads specially designed according to customer request.',
      ar: 'مسبحة مصممة خصيصًا وفقًا لطلب العميل.',
    },
    category: 'other',
    cover: '/images/gallery/5.jpeg',
    images: ['/images/gallery/5.jpeg'],
    date: '2023-12-15',
  },
  {
    id: '6',
    slug: 'koleksiyon-parca',
    title: {
      tr: 'Koleksiyon Parçası',
      en: 'Collection Piece',
      ar: 'قطعة مجموعة',
    },
    description: {
      tr: 'Koleksiyonluk değerinde nadir tesbih.',
      en: 'Rare prayer beads of collection value.',
      ar: 'مسبحة نادرة ذات قيمة للمجموعة.',
    },
    category: 'amber',
    cover: '/images/gallery/6.jpeg',
    images: ['/images/gallery/6.jpeg'],
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
