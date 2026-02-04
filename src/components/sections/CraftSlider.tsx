import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectCoverflow, Pagination, Navigation, Autoplay } from 'swiper/modules'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/pagination'
import 'swiper/css/navigation'

const craftImages = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  src: `/images/gallery/craft-${i + 1}.jpg`,
  alt: `El işi ${i + 1}`,
}))

export function CraftSlider() {
  const { t } = useTranslation()

  return (
    <section className="section-padding bg-base-200 overflow-hidden">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-base-content mb-4">
            {t('crafts.title', 'El İşlerim')}
          </h2>
          <p className="text-lg text-base-content/90 max-w-2xl mx-auto">
            {t('crafts.subtitle', 'Her biri özenle hazırlanmış, benzersiz el yapımı eserler')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          <Swiper
            effect="coverflow"
            grabCursor={true}
            centeredSlides={true}
            slidesPerView="auto"
            loop={true}
            autoplay={{
              delay: 3000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            coverflowEffect={{
              rotate: 0,
              stretch: 0,
              depth: 100,
              modifier: 2.5,
              slideShadows: false,
            }}
            pagination={{
              clickable: true,
              dynamicBullets: true,
            }}
            navigation={{
              prevEl: '.craft-slider-prev',
              nextEl: '.craft-slider-next',
            }}
            modules={[EffectCoverflow, Pagination, Navigation, Autoplay]}
            className="craft-slider py-12"
          >
            {craftImages.map((image) => (
              <SwiperSlide
                key={image.id}
                className="!w-[280px] sm:!w-[320px] md:!w-[380px] lg:!w-[420px]"
              >
                <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl bg-base-100 group">
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Navigation Buttons */}
          <button
            className="craft-slider-prev absolute left-2 md:left-8 top-1/2 -translate-y-1/2 z-10 btn btn-circle btn-primary shadow-lg"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            className="craft-slider-next absolute right-2 md:right-8 top-1/2 -translate-y-1/2 z-10 btn btn-circle btn-primary shadow-lg"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </motion.div>
      </div>

      <style>{`
        .craft-slider .swiper-pagination {
          bottom: 0 !important;
        }
        .craft-slider .swiper-pagination-bullet {
          background: oklch(var(--p));
          opacity: 0.4;
          width: 10px;
          height: 10px;
          transition: all 0.3s ease;
        }
        .craft-slider .swiper-pagination-bullet-active {
          opacity: 1;
          width: 24px;
          border-radius: 5px;
        }
        .craft-slider .swiper-slide {
          transition: all 0.3s ease;
        }
        .craft-slider .swiper-slide-active {
          transform: scale(1.05);
        }
      `}</style>
    </section>
  )
}
