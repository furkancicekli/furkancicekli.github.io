import type { GalleryItem, GalleryStore } from '../db/gallery'

export function fakeGalleryStore(): GalleryStore & { items: GalleryItem[] } {
  const items: GalleryItem[] = []
  let nextId = 1

  function sortedItems(): GalleryItem[] {
    return [...items].sort((a, b) => a.sort - b.sort || a.id - b.id)
  }

  return {
    items,
    async list(): Promise<GalleryItem[]> {
      return sortedItems().map((i) => ({ ...i }))
    },
    async create(r2Key: string, sort: number): Promise<GalleryItem> {
      const item: GalleryItem = { id: nextId++, r2Key, sort }
      items.push(item)
      return { ...item }
    },
    async updateSort(id: number, sort: number): Promise<GalleryItem | null> {
      const item = items.find((i) => i.id === id)
      if (!item) return null
      item.sort = sort
      return { ...item }
    },
    async delete(id: number): Promise<{ r2Key: string } | null> {
      const idx = items.findIndex((i) => i.id === id)
      if (idx === -1) return null
      const [removed] = items.splice(idx, 1)
      return { r2Key: removed.r2Key }
    },
  }
}
