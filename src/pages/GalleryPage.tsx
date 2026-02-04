import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { SEO } from '@/components/SEO'
import { ProjectCard } from '@/components/ui/ProjectCard'
import { projects, getProjectsByCategory } from '@/content/projects'

const categories = ['all', 'amber', 'kuka', 'oltu', 'other'] as const

export function GalleryPage() {
  const { t } = useTranslation()
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const filteredProjects = getProjectsByCategory(activeCategory)

  return (
    <>
      <SEO
        title={`${t('gallery.title')} | ${t('meta.title')}`}
        description={t('gallery.subtitle')}
      />

      <section className="pt-24 pb-16 bg-base-100">
        <div className="container-custom">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-base-content mb-4">
              {t('gallery.title')}
            </h1>
            <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
              {t('gallery.subtitle')}
            </p>
          </motion.div>

          {/* Category Filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-wrap justify-center gap-2 mb-12"
          >
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`btn btn-sm ${
                  activeCategory === category
                    ? 'btn-primary'
                    : 'btn-ghost'
                }`}
              >
                {t(`gallery.categories.${category}`)}
              </button>
            ))}
          </motion.div>

          {/* Projects Grid */}
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </motion.div>

          {/* Empty State */}
          {filteredProjects.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-base-content/60">
                {t('common.loading')}
              </p>
            </motion.div>
          )}

          {/* Info for adding new projects */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-16 text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-base-200 rounded-full text-sm text-base-content/60">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {projects.length} {t('stats.projects').toLowerCase().replace('+', '')}
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
