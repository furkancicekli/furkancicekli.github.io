import { SEO } from '@/components/SEO'
import { Hero, FeaturedProducts, GalleryPreview } from '@/components/sections'

export function HomePage() {
  return (
    <>
      <SEO />
      <Hero />
      <FeaturedProducts />
      <GalleryPreview />
    </>
  )
}
