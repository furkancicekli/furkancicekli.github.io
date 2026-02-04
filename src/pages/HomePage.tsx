import { SEO } from '@/components/SEO'
import {
  Hero,
  About,
  CraftSlider,
  GalleryPreview,
  Testimonials,
  Contact,
} from '@/components/sections'

export function HomePage() {
  return (
    <>
      <SEO />
      <Hero />
      <About />
      <CraftSlider />
      <GalleryPreview />
      <Testimonials />
      <Contact />
    </>
  )
}
