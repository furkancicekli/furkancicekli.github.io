export interface Certificate {
  id: number
  productId: number
  serialNo: string
  qrToken: string
  buyerName: string | null
  issuedAt: number
  productName?: string | null // list/verify join
  productSlug?: string | null // list/verify join
}

export interface CertStore {
  list(): Promise<Certificate[]> // issuedAt DESC, joined with product tr name
  create(productId: number, serialNo: string, qrToken: string, buyerName: string | null): Promise<Certificate>
  delete(id: number): Promise<boolean>
  findByToken(token: string): Promise<(Certificate & { material: string | null; size: string | null }) | null>
}

export function d1CertStore(db: D1Database): CertStore {
  return {
    async list() {
      const { results } = await db
        .prepare(
          `SELECT c.id AS id, c.product_id AS product_id, c.serial_no AS serial_no, c.qr_token AS qr_token,
                  c.buyer_name AS buyer_name, c.issued_at AS issued_at,
                  t.name AS product_name, p.slug AS product_slug
           FROM certificates c
           LEFT JOIN products p ON p.id = c.product_id
           LEFT JOIN product_translations t ON t.product_id = c.product_id AND t.lang = 'tr'
           ORDER BY c.issued_at DESC, c.id DESC`,
        )
        .all<{
          id: number
          product_id: number
          serial_no: string
          qr_token: string
          buyer_name: string | null
          issued_at: number
          product_name: string | null
          product_slug: string | null
        }>()
      return results.map((row) => ({
        id: row.id,
        productId: row.product_id,
        serialNo: row.serial_no,
        qrToken: row.qr_token,
        buyerName: row.buyer_name,
        issuedAt: row.issued_at,
        productName: row.product_name,
        productSlug: row.product_slug,
      }))
    },

    async create(productId, serialNo, qrToken, buyerName) {
      const row = await db
        .prepare(
          `INSERT INTO certificates (product_id, serial_no, qr_token, buyer_name)
           VALUES (?, ?, ?, ?)
           RETURNING id, issued_at`,
        )
        .bind(productId, serialNo, qrToken, buyerName)
        .first<{ id: number; issued_at: number }>()
      if (!row) throw new Error('failed to create certificate')

      const productRow = await db
        .prepare(
          `SELECT t.name AS product_name, p.slug AS product_slug
           FROM products p
           LEFT JOIN product_translations t ON t.product_id = p.id AND t.lang = 'tr'
           WHERE p.id = ?`,
        )
        .bind(productId)
        .first<{ product_name: string | null; product_slug: string | null }>()

      return {
        id: row.id,
        productId,
        serialNo,
        qrToken,
        buyerName,
        issuedAt: row.issued_at,
        productName: productRow?.product_name ?? null,
        productSlug: productRow?.product_slug ?? null,
      }
    },

    async delete(id) {
      const res = await db.prepare('DELETE FROM certificates WHERE id = ?').bind(id).run()
      return res.meta.changes > 0
    },

    async findByToken(token) {
      const row = await db
        .prepare(
          `SELECT c.id AS id, c.product_id AS product_id, c.serial_no AS serial_no, c.qr_token AS qr_token,
                  c.buyer_name AS buyer_name, c.issued_at AS issued_at,
                  t.name AS product_name, p.slug AS product_slug, p.material AS material, p.size AS size
           FROM certificates c
           LEFT JOIN products p ON p.id = c.product_id
           LEFT JOIN product_translations t ON t.product_id = c.product_id AND t.lang = 'tr'
           WHERE c.qr_token = ?`,
        )
        .bind(token)
        .first<{
          id: number
          product_id: number
          serial_no: string
          qr_token: string
          buyer_name: string | null
          issued_at: number
          product_name: string | null
          product_slug: string | null
          material: string | null
          size: string | null
        }>()
      if (!row) return null
      return {
        id: row.id,
        productId: row.product_id,
        serialNo: row.serial_no,
        qrToken: row.qr_token,
        buyerName: row.buyer_name,
        issuedAt: row.issued_at,
        productName: row.product_name,
        productSlug: row.product_slug,
        material: row.material,
        size: row.size,
      }
    },
  }
}
