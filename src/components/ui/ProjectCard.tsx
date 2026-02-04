import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ZoomIn, X } from 'lucide-react'
import type { Project } from '@/types'
import type { Language } from '@/i18n'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const lang = i18n.language as Language

  return (
    <>
      <motion.div
        className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-base-200"
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <img
          src={project.cover}
          alt={project.title[lang] || project.title.tr}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white font-semibold text-lg">
              {project.title[lang] || project.title.tr}
            </h3>
            <p className="text-white/70 text-sm line-clamp-2">
              {project.description[lang] || project.description.tr}
            </p>
          </div>
        </div>
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-base-100/90 rounded-full p-2">
            <ZoomIn className="w-5 h-5 text-base-content" />
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={project.cover}
                alt={project.title[lang] || project.title.tr}
                className="w-full h-full object-contain rounded-lg"
              />
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
                <h3 className="text-white font-semibold text-xl mb-2">
                  {project.title[lang] || project.title.tr}
                </h3>
                <p className="text-white/80">
                  {project.description[lang] || project.description.tr}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 btn btn-circle btn-sm bg-base-100/90 hover:bg-base-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
