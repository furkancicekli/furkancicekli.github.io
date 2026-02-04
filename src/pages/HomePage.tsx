import { SEO } from '@/components/SEO'
import {
  Hero,
  About,
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
      <GalleryPreview />
      <Testimonials />
      <Contact />
    </>
  )
}
