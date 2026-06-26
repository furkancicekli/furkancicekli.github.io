# Tasarım Spec'i — Faz 1: Temel & Cloudflare Altyapısı

**Tarih:** 2026-06-26
**Proje:** furkancicekli.com — Tesbih ustası portföyü → tam yığın (full-stack) uygulamaya geçiş
**Bu spec'in kapsamı:** Sadece **Faz 1**. Sonraki fazlar ayrı spec → plan → uygulama döngüsü alır.

---

## 1. Genel Vizyon (bağlam)

Statik GitHub Pages sitesi, Cloudflare üzerinde tam yığın bir uygulamaya dönüşecek:

- **Public site** + **admin paneli** (kullanıcı girişi yok, sadece admin).
- **Cloudflare Workers** (tek Worker'da SPA + API), **D1** (DB), **R2** (foto/video), **Hono** (API).
- Admin yönetir: ürünler, foto/video, hammadde görselleri, yapım süreci/hikaye, SSS, galeri.
- **Sertifika + QR:** ürün satılınca hem web orijinallik sayfası hem indirilebilir PDF üretilir; QR taranınca ürün orijinallik/detay sayfası açılır.
- Yeni public sayfalar: ürün detay, süreç/atölye, SSS, sipariş/teklif formu.

### Faz haritası (her faz ayrı teslim)
1. **Faz 1 — Temel & Cloudflare altyapısı** ← bu spec
2. Admin auth + panel kabuğu (e-posta/şifre, oturum, kullanıcı yönetimi)
3. İçerik yönetimi (CRUD): ürün/foto/video/SSS/süreç; public site D1/R2'den okur
4. Public UI tam revizyonu (shadcn + animasyon) + yeni public sayfalar
5. Sertifika + QR (web sayfası + PDF) orijinallik akışı

### Çapraz kesen kararlar (tüm fazları etkiler)
- **Stil:** daisyUI tamamen kaldırılır, **shadcn** (Tailwind + Radix + CSS variable temalar).
- **Görsel yön:** taban **rafine minimal-mono**; **renk modlu** — açık mod minimal-mono, koyu mod editoryal/galeri. Ürünler "sanat eseri" gibi listelenir.
- **İçerik dili:** Türkçe öncelikli + opsiyonel en/ar çeviri; çeviri boşsa Türkçe fallback. Arayüz etiketleri 3 dilde (tr/en/ar) kalır.
- **Paket yöneticisi:** npm (pnpm dosyaları silinir).
- **Cloudflare:** hesap mevcut, furkancicekli.com Cloudflare DNS'de.
- **Deploy:** GitHub Actions, `main` branch'e push'ta otomatik `wrangler deploy`.

---

## 2. Faz 1 Kapsamı

### 2.1 Engel kaldırma & temizlik
- **react-helmet düzeltmesi:** `react-helmet-async` kaldırılır (React 19 peer uyumsuzluğu npm hatasının sebebi). `src/components/SEO.tsx` React 19 native metadata kullanacak şekilde yeniden yazılır (`<title>`, `<meta>`, `<link>`, ld+json `<script>` doğrudan render edilir; React 19 bunları `<head>`'e taşır). `src/App.tsx`'ten `HelmetProvider` kaldırılır.
- **Lockfile:** `pnpm-lock.yaml` ve `pnpm-workspace.yaml` silinir; `package-lock.json` kalır; temiz `npm install`.
- **daisyUI söküm:** `daisyui` paketi kaldırılır; `tailwind.config.js`'ten daisyUI plugin'i ve `corporate`/`business` temaları çıkarılır.

**Kabul:** `npm install` hatasız; `npm run build` geçer.

### 2.2 Tasarım sistemi / shadcn tabanı
- shadcn kurulumu: `components.json`, `src/lib/utils.ts` (cn helper), gerekli bağımlılıklar (`class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, Radix primitive'leri ihtiyaç oldukça).
- **Temalar CSS variable ile:** `:root` (açık = minimal-mono) ve `.dark` (koyu = editoryal). Token'lar: background, foreground, card, primary, muted, border, ring, radius vb.
- **Tailwind v3** korunur; `tailwind.config.js` shadcn token'larını `theme.extend.colors` altında CSS variable'lara bağlar; `darkMode: 'class'`.
- **Font:** Inter (sans) + Playfair Display (serif) korunur; Noto Sans Arabic RTL için kalır.
- **ThemeSwitch yeniden bağlanır:** daisyUI `data-theme` yerine `<html>` üzerine `.dark` class toggle; tercih `localStorage`'da; ilk yüklemede FOUC önleyici inline script.
- **Kanıt bileşeni:** En az bir shadcn bileşeni (örn. `button`) eklenir; tam görsel revizyon DEĞİL (o Faz 4).

**Kabul:** Açık/koyu mod geçişi çalışır; mevcut sayfalar token'larla render olur (renkler değişebilir, layout bozulmaz).

### 2.3 Cloudflare altyapısı
- Bağımlılıklar: `@cloudflare/vite-plugin` (v1.7+), `wrangler` (v4.20+), `hono`, `@cloudflare/workers-types`.
- `vite.config.ts`'e Cloudflare plugin eklenir (mevcut React + MDX plugin'leriyle birlikte).
- **`wrangler.jsonc`:**
  ```jsonc
  {
    "name": "furkancicekli",
    "compatibility_date": "2026-06-25",
    "main": "./src/worker/index.ts",
    "assets": {
      "directory": "./dist/client",
      "binding": "ASSETS",
      "not_found_handling": "single-page-application",
      "run_worker_first": ["/api/*"]
    },
    "d1_databases": [{ "binding": "DB", "database_name": "furkancicekli", "database_id": "<doldurulacak>", "migrations_dir": "./migrations" }],
    "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "furkancicekli-media" }],
    "observability": { "enabled": true }
  }
  ```
  > Not: Vite plugin'in çıktı dizini `dist/client` (assets) + `dist/<worker>` olabilir; kesin yol Cloudflare Vite plugin tutorial'ına göre uygulamada netleştirilir.
- **Worker giriş `src/worker/index.ts`:** Hono app. Tipler `Bindings: { ASSETS, DB, MEDIA, ... }`. Route'lar `/api/*` altında. `GET /api/health` → `{ status: "ok" }` döner. `/api/*` dışındaki istekler statik asset/SPA'ya düşer (`run_worker_first` ile API önce çalışır).
- **D1 şeması (ilk taslak, additive migration `migrations/0001_init.sql`):** Sonraki fazlara hazır, Faz 1'de sadece oluşturulur (CRUD sonra).
  - `admin_users(id, email UNIQUE, password_hash, created_at)`
  - `sessions(id, user_id FK, expires_at, created_at)`
  - `products(id, slug UNIQUE, serial_no UNIQUE, status TEXT[draft|published|sold], material, size, price, created_at, updated_at)`
  - `product_translations(product_id FK, lang TEXT[tr|en|ar], name, description, story, PRIMARY KEY(product_id, lang))` — tr zorunlu (uygulama katmanında)
  - `product_media(id, product_id FK, type TEXT[image|video], r2_key, kind TEXT[gallery|raw_material|process], sort, created_at)`
  - `process_steps(id, product_id FK, sort, image_r2_key, created_at)` + `process_step_translations(step_id FK, lang, text, PK(step_id,lang))`
  - `faqs(id, sort, created_at)` + `faq_translations(faq_id FK, lang, question, answer, PK(faq_id,lang))`
  - `certificates(id, product_id FK, serial_no, qr_token UNIQUE, buyer_name, issued_at)`
  - `settings(key PRIMARY KEY, value)`
  > Migration'lar additive; sonraki fazlar yeni migration ekler, mevcutları değiştirmez.
- **R2 bucket** `furkancicekli-media` (binding `MEDIA`).
- **Lokal geliştirme:** `npm run dev` → Vite + Cloudflare plugin (Worker + D1 + R2 binding'leri Miniflare ile lokal). D1 migration lokalde uygulanır.

**Kabul:** Lokalde `/api/health` 200 döner; SPA servis edilir; `0001_init.sql` lokal D1'e uygulanır; R2 binding erişilebilir.

### 2.4 Mevcut asset'lerin R2'ya yüklenmesi (seed)
- **Seed script `scripts/seed-r2.ts`** (veya `wrangler r2 object put` döngüsü): mevcut **içerik görselleri** R2'ya yüklenir, key yapısı korunur:
  - `public/images/gallery/craft-1..20.jpg` → `gallery/craft-N.jpg`
  - `public/images/about/*.jpeg` → `about/*`
  - `public/images/hero/1.jpeg` → `hero/1.jpeg`
  - `public/images/pp1.jpeg, pp2.jpeg, example.jpeg` → `misc/*`
- **`/public`'te kalır (R2'ya gitmez):** favicon'lar, `FURKANLOGO.png`, `site.webmanifest`, `404.html`, `sitemap.xml`, `robots.txt`, `CNAME` (uygulama static asset'i; Worker `ASSETS` ile sunar).
- Faz 1'de public site görselleri **hâlâ `/public`'ten** sunar (görsel kaybı/regresyon olmasın). R2'dan okumaya geçiş **Faz 3 (içerik yönetimi)**'nde.

**Kabul:** İçerik görselleri R2'da listelenebilir; public site görselleri bozulmadan çalışır.

### 2.5 Dağıtım & ops (GitHub Actions)
- Mevcut `.github/workflows/deploy.yml` (gh-pages) **Cloudflare deploy** ile değiştirilir.
- **Tetik:** `main` branch'e push.
- **Adımlar:** checkout → node setup → `npm ci` → `npm run build` → `wrangler d1 migrations apply furkancicekli --remote` → `wrangler deploy`.
- **GitHub secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (kullanıcı GitHub repo settings'te ekler).
- `package.json` scriptleri: `dev` (vite), `build`, `deploy` (`wrangler deploy`), `db:migrate` vb. `gh-pages` script'i ve bağımlılığı kaldırılır.
- **Domain:** Geliştirme önce `*.workers.dev`. furkancicekli.com mevcut sitede canlı kalır; Cloudflare Worker'a custom domain bağlama (route) **bilinçli, ayrı bir cutover adımı** (kullanıcı onayıyla). `CNAME` dosyası cutover sonrası gereksiz.
- **Reserve edilen secret isimleri (kullanımı Faz 2):** `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`.

**Kabul:** `main`'e push → Actions build + deploy başarılı; deploy edilen Worker `/api/health` döner ve SPA'yı sunar.

---

## 3. Mimari Notlar / İzolasyon

- **Tek Worker, iki sorumluluk net ayrık:** `src/worker/` (API, Hono) ve `src/` (React SPA). API yalnız `/api/*`; SPA route'ları SPA fallback'e düşer.
- **`src/worker/` iç yapısı:** `index.ts` (app + route montaj), `routes/` (health; sonra auth/products/...), `db/` (D1 sorguları), ileride `lib/` (auth, r2 yardımcıları). Her dosya tek sorumluluk.
- **Tipler:** `Env`/`Bindings` tek yerde tanımlı; `wrangler types` ile üretilen tipler kullanılır.
- **Migration'lar additive ve sıralı** (`migrations/NNNN_*.sql`).

## 4. Kapsam Dışı (Faz 1 DEĞİL)
- Admin auth/login akışı ve panel UI (Faz 2).
- Ürün/içerik CRUD ve public site'ın D1/R2'dan okuması (Faz 3).
- Public UI tam görsel revizyonu ve yeni sayfalar (Faz 4).
- Sertifika/QR/PDF üretimi (Faz 5).
- Domain cutover (ayrı, kullanıcı onaylı adım).

## 5. Riskler / Açık Noktalar
- Cloudflare Vite plugin build çıktı dizini (`dist/client`) uygulamada doğrulanmalı; `wrangler.jsonc` `assets.directory` ona göre ayarlanır.
- MDX rollup plugin'i ile Cloudflare Vite plugin birlikte çalışması doğrulanmalı.
- React 19 native metadata'nın ld+json `<script>` ve `<html lang/dir>` davranışı doğrulanmalı (gerekirse `lang/dir` `<html>` üzerinde i18n efektiyle ayarlanır, metadata değil).
- D1 şeması ilk taslak; sonraki fazlarda additive migration ile evrilir.
