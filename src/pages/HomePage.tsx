import { SEO } from '@/components/SEO'
import {
  Hero,
  FeaturedProducts,
  About,
  CraftStack,
  GalleryPreview,
  Testimonials,
  Contact,
} from '@/components/sections'

export function HomePage() {
  return (
    <>
      <SEO />
      <Hero />
      <FeaturedProducts />
      <About />
      <CraftStack />
      <GalleryPreview />
      <Testimonials />
      <Contact />
    </>
  )
}
