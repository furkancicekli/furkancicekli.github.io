import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { productMetaRoutes, type ProductMetaEnv, escapeHtmlAttr } from './product-meta'
import { fakeProductStore } from '../test/fake-product-store'

// src/worker/routes/product-meta.test.ts -> repo root index.html is three
// levels up. `@cloudflare/workers-types` (loaded for the worker tsconfig
// program) declares its own ambient `URL` global that isn't structurally
// identical to Node's `url.URL`, so the pathname is read off the URL
// instance directly rather than passing it through `fileURLToPath`.
const REAL_INDEX_HTML_PATH = new URL('../../../index.html', import.meta.url).pathname
const REAL_INDEX_HTML = readFileSync(REAL_INDEX_HTML_PATH, 'utf-8')

const HEAD_HTML = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Primary Meta Tags -->
    <title>Furkan Çiçekli | Tesbih Ustası</title>
    <meta name="title" content="Furkan Çiçekli | Tesbih Ustası" />
    <meta name="description" content="El yapımı tesbihlerin ustası; geleneksel zanaatı modern tasarımla birleştiriyor." />
    <meta name="keywords" content="tesbih, el yapimi tesbih, tesbih ustasi, kehribar tesbih, kuka tesbih" />
    <meta name="author" content="Furkan Cicekli" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://furkancicekli.com/" />
    <meta property="og:title" content="Furkan Çiçekli | Tesbih Ustası" />
    <meta property="og:description" content="El yapımı tesbihlerin ustası; geleneksel zanaatı modern tasarımla birleştiriyor." />
    <meta property="og:image" content="https://furkancicekli.com/og-default.jpg" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="https://furkancicekli.com/" />
    <meta property="twitter:title" content="Furkan Çiçekli | Tesbih Ustası" />
    <meta property="twitter:description" content="El yapımı tesbihlerin ustası; geleneksel zanaatı modern tasarımla birleştiriyor." />
    <meta property="twitter:image" content="https://furkancicekli.com/og-default.jpg" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'kuka-tesbih',
    status: 'published' as const,
    material: 'Kuka',
    size: '10mm',
    weightGrams: 25,
    translations: { tr: { name: 'Kuka Tesbih', description: 'Elle işlenmiş kuka tesbih, doğal malzeme.', story: 'Hikaye' } },
    ...overrides,
  }
}

function fakeAssets(body: string, contentType = 'text/html; charset=utf-8'): Fetcher {
  return {
    fetch: async () => new Response(body, { headers: { 'content-type': contentType } }),
  } as unknown as Fetcher
}

describe('product-meta route', () => {
  let productStore: ReturnType<typeof fakeProductStore>
  let app: Hono<ProductMetaEnv>

  beforeEach(() => {
    productStore = fakeProductStore()
    app = new Hono<ProductMetaEnv>()
    app.use('*', async (c, next) => {
      c.set('productStore', productStore)
      await next()
    })
    app.route('/', productMetaRoutes)
  })

  it('rewrites title, og, and twitter tags for a published product', async () => {
    const product = await productStore.create(validInput())
    await productStore.addMedia(product.id, { type: 'image', r2Key: 'products/kuka-tesbih/cover.jpg', kind: 'gallery', sort: 0 })

    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: fakeAssets(HEAD_HTML) })
    expect(res.status).toBe(200)
    const text = await res.text()

    expect(text).toContain('<title>Kuka Tesbih | Furkan Çiçekli | Tesbih Ustası</title>')
    expect(text).toContain('<meta property="og:title" content="Kuka Tesbih" />')
    expect(text).toContain('<meta property="twitter:title" content="Kuka Tesbih" />')
    expect(text).toContain(
      '<meta property="og:image" content="https://furkancicekli.com/api/media/products/kuka-tesbih/cover.jpg" />',
    )
    expect(text).toContain(
      '<meta property="twitter:image" content="https://furkancicekli.com/api/media/products/kuka-tesbih/cover.jpg" />',
    )
    expect(text).toContain('<meta property="og:url" content="https://furkancicekli.com/products/kuka-tesbih" />')
    expect(text).toContain('<meta property="twitter:url" content="https://furkancicekli.com/products/kuka-tesbih" />')
    expect(text).toContain(
      '<meta name="description" content="Elle işlenmiş kuka tesbih, doğal malzeme." />',
    )
    expect(text).toContain(
      '<meta property="og:description" content="Elle işlenmiş kuka tesbih, doğal malzeme." />',
    )
    expect(text).toContain(
      '<meta property="twitter:description" content="Elle işlenmiş kuka tesbih, doğal malzeme." />',
    )
  })

  it('sets Cache-Control: public, max-age=300 on the rewritten response', async () => {
    await productStore.create(validInput())
    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: fakeAssets(HEAD_HTML) })
    expect(res.headers.get('cache-control')).toBe('public, max-age=300')
  })

  it('falls back to default og image when product has no gallery media', async () => {
    await productStore.create(validInput())
    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: fakeAssets(HEAD_HTML) })
    const text = await res.text()
    expect(text).toContain('<meta property="og:image" content="https://furkancicekli.com/og-default.jpg" />')
  })

  it('picks the first IMAGE-kind gallery media for og:image when the gallery starts with a video', async () => {
    const product = await productStore.create(validInput())
    await productStore.addMedia(product.id, { type: 'video', r2Key: 'products/kuka-tesbih/cover.mp4', kind: 'gallery', sort: 0 })
    await productStore.addMedia(product.id, { type: 'image', r2Key: 'products/kuka-tesbih/second.jpg', kind: 'gallery', sort: 1 })

    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: fakeAssets(HEAD_HTML) })
    const text = await res.text()

    expect(text).toContain(
      '<meta property="og:image" content="https://furkancicekli.com/api/media/products/kuka-tesbih/second.jpg" />',
    )
    expect(text).toContain(
      '<meta property="twitter:image" content="https://furkancicekli.com/api/media/products/kuka-tesbih/second.jpg" />',
    )
    expect(text).not.toContain('cover.mp4')
  })

  it('falls back to default og image when every gallery media is a video', async () => {
    const product = await productStore.create(validInput())
    await productStore.addMedia(product.id, { type: 'video', r2Key: 'products/kuka-tesbih/cover.mp4', kind: 'gallery', sort: 0 })

    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: fakeAssets(HEAD_HTML) })
    const text = await res.text()

    expect(text).toContain('<meta property="og:image" content="https://furkancicekli.com/og-default.jpg" />')
    expect(text).toContain('<meta property="twitter:image" content="https://furkancicekli.com/og-default.jpg" />')
    expect(text).not.toContain('cover.mp4')
  })

  it('truncates a long description to about 200 chars with ellipsis', async () => {
    const longDescription = 'kelime '.repeat(60).trim()
    await productStore.create(validInput({ translations: { tr: { name: 'Uzun Ürün', description: longDescription, story: null } } }))

    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: fakeAssets(HEAD_HTML) })
    const text = await res.text()
    const match = text.match(/<meta name="description" content="([^"]*)" \/>/)
    expect(match).not.toBeNull()
    const content = match![1]
    expect(content.length).toBeLessThanOrEqual(204)
    expect(content.endsWith('...')).toBe(true)
  })

  it('returns the HTML unchanged for an unknown slug', async () => {
    const res = await app.request('/products/does-not-exist', {}, { ASSETS: fakeAssets(HEAD_HTML) })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe(HEAD_HTML)
  })

  it('returns the HTML unchanged for a draft (unpublished) product', async () => {
    await productStore.create(validInput({ status: 'draft' }))
    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: fakeAssets(HEAD_HTML) })
    const text = await res.text()
    expect(text).toBe(HEAD_HTML)
  })

  it('returns non-HTML asset responses untouched', async () => {
    await productStore.create(validInput())
    const pngBytes = new Uint8Array([1, 2, 3])
    const assets: Fetcher = {
      fetch: async () => new Response(pngBytes, { headers: { 'content-type': 'image/png' } }),
    } as unknown as Fetcher

    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: assets })
    expect(res.headers.get('content-type')).toBe('image/png')
    const buf = await res.arrayBuffer()
    expect(new Uint8Array(buf)).toEqual(pngBytes)
  })

  it('escapes XSS-unsafe characters in product name within attributes and title', async () => {
    await productStore.create(
      validInput({ translations: { tr: { name: `Tesbih "Kral" <script>`, description: 'desc', story: null } } }),
    )

    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: fakeAssets(HEAD_HTML) })
    const text = await res.text()

    expect(text).not.toContain('<script>')
    expect(text).toContain('<title>Tesbih &quot;Kral&quot; &lt;script&gt; | Furkan Çiçekli | Tesbih Ustası</title>')
    expect(text).toContain('<meta property="og:title" content="Tesbih &quot;Kral&quot; &lt;script&gt;" />')
  })

  it('treats $-sequences in product text literally (String.replace pattern injection)', async () => {
    // `&` escape edilince `&amp;` olur; string-replacement kullanılsaydı `$&`
    // dizisi replace kalıbı olarak yorumlanır ve meta bozulurdu.
    await productStore.create(
      validInput({ translations: { tr: { name: `Gümüş & İpek $' Tesbih`, description: `Fiyat $& kalite`, story: null } } }),
    )

    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: fakeAssets(HEAD_HTML) })
    const text = await res.text()

    expect(text).toContain('<meta property="og:title" content="Gümüş &amp; İpek $&#39; Tesbih" />')
    expect(text).toContain('content="Fiyat $&amp; kalite"')
  })
})

describe('escapeHtmlAttr', () => {
  it('escapes &, <, >, ", and \'', () => {
    expect(escapeHtmlAttr(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;')
  })

  it('leaves plain text unchanged', () => {
    expect(escapeHtmlAttr('Kuka Tesbih')).toBe('Kuka Tesbih')
  })
})

describe('product-meta route against the real index.html', () => {
  let productStore: ReturnType<typeof fakeProductStore>
  let app: Hono<ProductMetaEnv>

  beforeEach(() => {
    productStore = fakeProductStore()
    app = new Hono<ProductMetaEnv>()
    app.use('*', async (c, next) => {
      c.set('productStore', productStore)
      await next()
    })
    app.route('/', productMetaRoutes)
  })

  it('rewrites every social/meta tag in the real repo-root index.html for a published product', async () => {
    await productStore.create(
      validInput({
        slug: 'kuka-tesbih',
        translations: {
          tr: {
            name: 'Kuka Tesbih',
            description: 'Elle işlenmiş kuka tesbih, doğal malzeme ve özenli işçilikle üretildi.',
            story: 'Hikaye',
          },
        },
      }),
    )
    await productStore.addMedia(1, { type: 'image', r2Key: 'products/kuka-tesbih/cover.jpg', kind: 'gallery', sort: 0 })

    const res = await app.request('/products/kuka-tesbih', {}, { ASSETS: fakeAssets(REAL_INDEX_HTML) })
    expect(res.status).toBe(200)
    const text = await res.text()

    // The rewrite must actually touch the file - guards against future
    // index.html edits (e.g. changed tag markers) silently breaking the
    // string-replace matching and turning the rewrite into a no-op.
    expect(text).not.toBe(REAL_INDEX_HTML)

    expect(text).toContain('<meta property="og:title" content="Kuka Tesbih" />')
    expect(text).toContain('<title>Kuka Tesbih | Furkan Çiçekli | Tesbih Ustası</title>')

    const defaultTitle = 'Furkan Çiçekli | Tesbih Ustası'
    const defaultDescription = 'El yapımı tesbihlerin ustası; geleneksel zanaatı modern tasarımla birleştiriyor.'
    const defaultImage = 'https://furkancicekli.com/og-default.jpg'
    const defaultUrl = 'https://furkancicekli.com/'

    expect(text).not.toContain(`<title>${defaultTitle}</title>`)
    expect(text).not.toContain(`<meta property="og:title" content="${defaultTitle}" />`)
    expect(text).not.toContain(`<meta property="twitter:title" content="${defaultTitle}" />`)
    expect(text).not.toContain(`<meta name="description" content="${defaultDescription}" />`)
    expect(text).not.toContain(`<meta property="og:description" content="${defaultDescription}" />`)
    expect(text).not.toContain(`<meta property="twitter:description" content="${defaultDescription}" />`)
    expect(text).not.toContain(`<meta property="og:image" content="${defaultImage}" />`)
    expect(text).not.toContain(`<meta property="twitter:image" content="${defaultImage}" />`)
    expect(text).not.toContain(`<meta property="og:url" content="${defaultUrl}" />`)
    expect(text).not.toContain(`<meta property="twitter:url" content="${defaultUrl}" />`)
  })
})
