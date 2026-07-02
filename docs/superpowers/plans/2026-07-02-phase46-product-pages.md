# Faz 4.6 — Ürün Detay Sayfaları + Dinamik Sitemap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Sözleşme-bazlı.

**Goal:** Her yayındaki ürüne mobile-first, SEO'lu bir detay sayfası (`/products/:slug`); ürün kartları modal yerine sayfaya gider; sitemap worker'dan dinamik üretilir (ürün URL'leri dahil).

## Global Constraints
- Public detail API hazır: `GET /api/products/:slug?lang=` (name, description, story, material, size, weightGrams, serialNo, media[gallery→process sıralı]). Worker'da İÇERİK değişikliği gerekmiyor (Task 2'de sitemap eklenir).
- Tasarım: mevcut token'lar + Bricolage başlıklar; MOBILE-FIRST (dar ekran birincil, md+ iki kolon); i18n ×3 (public sayfa — hardcoded Türkçe yasak); erişilebilirlik (lightbox Escape/scroll-lock, alt metinler, buton semantiği).
- ProductModal kullanımdan kalkar ve SİLİNİR (kartlar Link olur); e2e buna göre güncellenir.
- Sitemap: `wrangler.jsonc` `run_worker_first`'e `/sitemap.xml` eklenir; worker route static+ürün URL'lerini üretir; `public/sitemap.xml` silinir.
- Her task sonunda unit+build+lint yeşil; e2e Task 3'te.

## Task 1: ProductDetailPage (UI, mobile-first) + kart yönlendirmesi
- `src/pages/ProductDetailPage.tsx` (`/products/:slug`, PublicShell):
  - **Galeri (üst, mobil öncelikli):** ana görsel tam genişlik (aspect-square, object-cover); altında yatay snap-scroll küçük resim şeridi (`overflow-x-auto snap-x`, her thumb `snap-start`, aktif kenarlıklı); görsel sayacı (örn. `2/7`, aria-live polite). Ana görsele dokununca tam ekran lightbox (GalleryPage deseni: overlay, X, Escape, scroll lock; içinde ‹ › gezinme). Video'lar `<video controls playsInline>` olarak şeritte.
  - **Bilgi bölümü:** h1 ürün adı (font-serif), "Özellikler" spec listesi (Malzeme/Ebat/Gram — yalnız doluysa; gram `34,5 g` locale), açıklama paragrafı, varsa "Hikaye" alt başlıklı hikaye, seri no satırı (mono, formatlı, `product.serial` i18n etiketi) + `/verify` linki ("Sertifikayı doğrula").
  - **CTA:** WhatsApp linki `https://wa.me/<numara>?text=<ürün adı + sayfa URL'i encode>` — "Bu eser hakkında yaz" (i18n); buton primary. İkincil: `/products`'a geri link (← Tüm eserler).
  - **Yapım Aşamaları:** process medyası varsa ayrı bölüm (başlık i18n), mobilde yatay scroll, md+ grid; aynı lightbox'a bağlı.
  - Durumlar: loading skeleton (görsel + satır blokları), 404 → "Eser bulunamadı" + /products linki (SEO noindex GEREKMEZ; 404 durumunda robots noindex meta bas).
  - **SEO:** `<SEO title={ad | meta.title} description={açıklama ilk ~150} image={cover} url auto} structuredDataExtra={Product şeması: name, image[] (tüm gallery), description, material, brand {'@type':'Person', name: siteConfig.name}, sku: serialNo}>`.
- ProductCard: onClick/modal yerine `<Link to={/products/${slug}}>`; ProductsPage + FeaturedProducts'tan modal state'leri kalkar; `ProductModal.tsx` SİLİNİR (barrel dahil).
- i18n yeni anahtarlar ×3: product.specs, product.story, product.serial, product.verifyCta, product.whatsappCta, product.backToAll, product.notFound(+body), product.processTitle, a11y.nextImage/prevImage.
Commit: `feat(public): mobile-first product detail pages replace modal`

## Task 2: Dinamik sitemap (worker, TDD)
- `src/worker/routes/sitemap.ts`: `GET /sitemap.xml` → `application/xml`; statik rotalar (/, /products, /gallery, /faq, /contact, /verify) + `listPublished()` ürünleri (`/products/<slug>`, lastmod = updatedAt ISO tarihi — store satırına updatedAt eklenir gerekirse). Cache-Control: public, max-age=3600. XML escape (slug'lar zaten [a-z0-9-]).
- `wrangler.jsonc`: `run_worker_first: ["/api/*", "/sitemap.xml"]`. `public/sitemap.xml` SİLİNİR.
- index.ts mount (public, productStore middleware). Testler: 200+content-type, statik URL'ler var, yayındaki ürün var + taslak YOK, XML well-formed (basit parse/regex).
Commit: `feat(seo): dynamic sitemap served by worker with product URLs`

## Task 3: E2E + tam doğrulama
- `public-content.spec.ts`: modal assert'leri → detay sayfası akışı (kart tıkla → URL /products/slug → ad h1 görünür → lightbox aç/kapa → geri linki). Sitemap smoke: `request.get('/sitemap.xml')` 200 + yayındaki test ürünü slug'ı içerir.
- Tam: unit+build+lint+tüm e2e.
Commit: `test(public): product detail page and dynamic sitemap flows`
