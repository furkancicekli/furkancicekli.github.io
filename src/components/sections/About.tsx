import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const aboutImages = [
  '/images/about/1.jpeg',
  '/images/about/2.jpeg',
  '/images/about/3.jpeg',
]

export function About() {
  const { t } = useTranslation()
  const [currentImage, setCurrentImage] = useState(0)

  const nextImage = useCallback(() => {
    setCurrentImage((prev) => (prev + 1) % aboutImages.length)
  }, [])

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + aboutImages.length) % aboutImages.length)
  }

  useEffect(() => {
    const timer = setInterval(nextImage, 5000)
    return () => clearInterval(timer)
  }, [nextImage])

  return (
    <section id="about" className="section-padding bg-base-200">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-xl bg-base-300">
              {aboutImages.map((img, index) => (
                <motion.img
                  key={img}
                  src={img}
                  alt={`About ${index + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: index === currentImage ? 1 : 0 }}
                  transition={{ duration: 0.5 }}
                  loading="lazy"
                />
              ))}
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
              <button
                onClick={prevImage}
                className="btn btn-circle btn-sm bg-base-100/80 backdrop-blur-sm hover:bg-base-100"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex gap-2">
                {aboutImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImage(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentImage
                        ? 'bg-primary w-4'
                        : 'bg-base-content/30'
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
              <button
                onClick={nextImage}
                className="btn btn-circle btn-sm bg-base-100/80 backdrop-blur-sm hover:bg-base-100"
                aria-label="Next image"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-base-content mb-4">
              {t('about.title')}
            </h2>
            <p className="text-lg text-base-content/70 mb-6">{t('about.subtitle')}</p>
            <div className="space-y-4 text-base-content/70">
              <p>{t('about.p1')}</p>
              <p>{t('about.p2')}</p>
              <p>{t('about.p3')}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
