import type { Certificate, CertStore } from '../db/certificates'
import type { fakeProductStore } from './fake-product-store'

export function fakeCertStore(productStore: ReturnType<typeof fakeProductStore>): CertStore & { certificates: Certificate[] } {
  const certificates: Certificate[] = []
  let nextId = 1

  function withProductFields(cert: Certificate): Certificate {
    const product = productStore.products.find((p) => p.id === cert.productId)
    return {
      ...cert,
      productName: product?.translations.tr?.name ?? null,
      productSlug: product?.slug ?? null,
    }
  }

  return {
    certificates,
    async list(): Promise<Certificate[]> {
      return [...certificates]
        .sort((a, b) => {
          const issuedAtDiff = b.issuedAt - a.issuedAt
          if (issuedAtDiff !== 0) return issuedAtDiff
          return b.id - a.id // tiebreaker for same-second issuedAt
        })
        .map(withProductFields)
    },
    async create(productId: number, serialNo: string, qrToken: string, buyerName: string | null): Promise<Certificate> {
      const cert: Certificate = {
        id: nextId++,
        productId,
        serialNo,
        qrToken,
        buyerName,
        issuedAt: Math.floor(Date.now() / 1000),
      }
      certificates.push(cert)
      return withProductFields(cert)
    },
    async delete(id: number): Promise<boolean> {
      const idx = certificates.findIndex((c) => c.id === id)
      if (idx === -1) return false
      certificates.splice(idx, 1)
      return true
    },
    async findByToken(token: string) {
      const cert = certificates.find((c) => c.qrToken === token)
      if (!cert) return null
      const product = productStore.products.find((p) => p.id === cert.productId)
      return {
        ...withProductFields(cert),
        material: product?.material ?? null,
        size: product?.size ?? null,
      }
    },
  }
}
