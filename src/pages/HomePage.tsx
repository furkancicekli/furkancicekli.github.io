import { SEO } from '@/components/SEO'
import {
  Hero,
  Stats,
  About,
  CraftSlider,
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
      <Stats />
      <About />
      <CraftSlider />
      <CraftStack />
      <GalleryPreview />
      <Testimonials />
      <Contact />
    </>
  )
}
