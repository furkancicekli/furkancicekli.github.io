import type {
  Lang,
  ProcessStep,
  ProductDetail,
  ProductInput,
  ProductListItem,
  ProductMediaItem,
  ProductStore,
} from '../db/products'

type InternalMedia = ProductMediaItem & { productId: number }
type InternalStep = ProcessStep & { productId: number }

function omitProductId<T extends { productId: number }>(item: T): Omit<T, 'productId'> {
  const copy: Partial<T> = { ...item }
  delete copy.productId
  return copy as Omit<T, 'productId'>
}

export function fakeProductStore(): ProductStore & {
  products: (ProductDetail & { translations: Partial<Record<Lang, { name: string | null; description: string | null; story: string | null }>> })[]
  media: InternalMedia[]
  steps: InternalStep[]
} {
  const products: ProductDetail[] = []
  const media: InternalMedia[] = []
  const steps: InternalStep[] = []
  let nextProductId = 1
  let nextMediaId = 1
  let nextStepId = 1

  function mediaCount(productId: number) {
    return media.filter((m) => m.productId === productId).length
  }

  function toDetail(p: ProductDetail): ProductDetail {
    return {
      ...p,
      translations: { ...p.translations },
      media: media
        .filter((m) => m.productId === p.id)
        .sort((a, b) => a.sort - b.sort)
        .map(omitProductId),
      steps: steps
        .filter((s) => s.productId === p.id)
        .sort((a, b) => a.sort - b.sort)
        .map(omitProductId),
    }
  }

  return {
    products,
    media,
    steps,
    async list(): Promise<ProductListItem[]> {
      return products.map((p) => ({
        id: p.id,
        slug: p.slug,
        serialNo: p.serialNo,
        status: p.status,
        name: p.translations.tr?.name ?? null,
        price: p.price,
        mediaCount: mediaCount(p.id),
        createdAt: p.createdAt,
      }))
    },
    async get(id: number): Promise<ProductDetail | null> {
      const p = products.find((x) => x.id === id)
      return p ? toDetail(p) : null
    },
    async findBySlug(slug: string) {
      const p = products.find((x) => x.slug === slug)
      return p ? { id: p.id } : null
    },
    async findBySerial(serialNo: string) {
      const p = products.find((x) => x.serialNo === serialNo)
      return p ? { id: p.id } : null
    },
    async create(input: ProductInput): Promise<ProductDetail> {
      const now = Math.floor(Date.now() / 1000)
      const p: ProductDetail = {
        id: nextProductId++,
        slug: input.slug,
        serialNo: input.serialNo ?? null,
        status: input.status,
        material: input.material ?? null,
        size: input.size ?? null,
        price: input.price ?? null,
        createdAt: now,
        updatedAt: now,
        translations: { ...input.translations },
        media: [],
        steps: [],
      }
      products.push(p)
      return toDetail(p)
    },
    async update(id: number, input: ProductInput): Promise<ProductDetail | null> {
      const p = products.find((x) => x.id === id)
      if (!p) return null
      p.slug = input.slug
      p.serialNo = input.serialNo ?? null
      p.status = input.status
      p.material = input.material ?? null
      p.size = input.size ?? null
      p.price = input.price ?? null
      p.updatedAt = Math.floor(Date.now() / 1000)
      p.translations = { ...input.translations }
      return toDetail(p)
    },
    async delete(id: number): Promise<boolean> {
      const idx = products.findIndex((x) => x.id === id)
      if (idx === -1) return false
      products.splice(idx, 1)
      for (let i = media.length - 1; i >= 0; i--) {
        if (media[i].productId === id) media.splice(i, 1)
      }
      for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].productId === id) steps.splice(i, 1)
      }
      return true
    },
    async addStep(productId: number, texts: Partial<Record<Lang, string>>, sort: number): Promise<ProcessStep> {
      const step: InternalStep = { id: nextStepId++, productId, sort, texts: { ...texts } }
      steps.push(step)
      return omitProductId(step)
    },
    async updateStep(stepId: number, texts: Partial<Record<Lang, string>>, sort: number): Promise<ProcessStep | null> {
      const step = steps.find((s) => s.id === stepId)
      if (!step) return null
      step.sort = sort
      step.texts = { ...texts }
      return omitProductId(step)
    },
    async deleteStep(stepId: number): Promise<boolean> {
      const idx = steps.findIndex((s) => s.id === stepId)
      if (idx === -1) return false
      steps.splice(idx, 1)
      return true
    },
    async addMedia(productId: number, m: { type: 'image' | 'video'; r2Key: string; kind: string; sort: number }): Promise<ProductMediaItem> {
      const item: InternalMedia = {
        id: nextMediaId++,
        productId,
        type: m.type,
        r2Key: m.r2Key,
        kind: m.kind as ProductMediaItem['kind'],
        sort: m.sort,
      }
      media.push(item)
      return omitProductId(item)
    },
    async getMedia(mediaId: number): Promise<(ProductMediaItem & { productId: number }) | null> {
      const item = media.find((m) => m.id === mediaId)
      return item ? { ...item } : null
    },
    async updateMedia(mediaId: number, patch: { kind?: string; sort?: number }): Promise<ProductMediaItem | null> {
      const item = media.find((m) => m.id === mediaId)
      if (!item) return null
      if (patch.kind !== undefined) item.kind = patch.kind as ProductMediaItem['kind']
      if (patch.sort !== undefined) item.sort = patch.sort
      return omitProductId(item)
    },
    async deleteMedia(mediaId: number): Promise<boolean> {
      const idx = media.findIndex((m) => m.id === mediaId)
      if (idx === -1) return false
      media.splice(idx, 1)
      return true
    },
  }
}
