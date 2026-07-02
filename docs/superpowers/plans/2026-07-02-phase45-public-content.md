# Faz 4.5 — Public Site Yönetilen İçeriğe Geçiş Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Sözleşme-bazlı plan; Faz 2-3.5 kalıpları geçerli.

**Goal:** Landing ve public sayfaların içeriğini admin'den yönetilir yapmak: yayındaki ürünler sitede (modal detaylı), galeri admin'den yönetilir (mevcut atölye fotoğrafları devralınır), biyografi tamamen kalkar, her nav öğesinin kendi sayfası olur, wizard'a "Sitede yayınla" (varsayılan açık) gelir.

**Müşteri kararları:** Furkan yalnız sanatının görünmesini istiyor — biyografi yok. Ürünler varsayılan yayınlanır. Galeri bağımsız koleksiyon (ürün medyasından ayrı). Nav: Ana Sayfa /, Ürünler /products, Galeri /gallery, SSS /faq, İletişim /contact, Sertifika Sorgula /verify.

## Global Constraints

- YENİ migration `migrations/0004_gallery.sql` (aşağıda) — 0001-0003 değişmez (0003 = cert serial UNIQUE, P3.5 final-review fix). Seed INSERT'leri mevcut R2 key'lerini kullanır (`gallery/craft-1.jpg` … `gallery/craft-20.jpg`, Faz 1'de yüklendi).
- Public API'ler açık (auth yok), admin API'ler mevcut requireAuth zincirinde; hata gövdesi `{error:'<kod>'}` kalıbı.
- Public sayfalarda dil: mevcut i18n dili (i18next `i18n.language` → 'tr'|'en'|'ar') API `lang` parametresine geçilir; çeviri boşsa tr fallback SUNUCUDA yapılır (faqs deseni).
- Public UI mevcut tasarım dili: token'lar, Arvo/Lato, mevcut lightbox/section desenleri. Yeni npm bağımlılığı YOK.
- Statik bölümler kaldırılır: `About` (biyografi), `CraftStack`, `Testimonials`, `CraftSlider`, `Stats` (kullanılmayanlar dahil) — component dosyaları silinir, i18n anahtarları kalabilir (temizlik ayrı iş; nav.about anahtarları nav'dan çıkar). `stats` config'i kalkar.
- `/#about`, `/#contact` hash nav'ları kalkar; nav artık gerçek rotalara gider.
- Testler: worker TDD (fake store), UI build/lint, e2e Task 8'de güncellenir. Her task sonunda unit+build yeşil.

## migrations/0004_gallery.sql

```sql
CREATE TABLE gallery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
-- Mevcut atölye fotoğrafları (Faz 1'de R2'ya yüklendi) devralınır:
INSERT INTO gallery_items (r2_key, sort) VALUES
('gallery/craft-1.jpg',1),('gallery/craft-2.jpg',2),('gallery/craft-3.jpg',3),('gallery/craft-4.jpg',4),
('gallery/craft-5.jpg',5),('gallery/craft-6.jpg',6),('gallery/craft-7.jpg',7),('gallery/craft-8.jpg',8),
('gallery/craft-9.jpg',9),('gallery/craft-10.jpg',10),('gallery/craft-11.jpg',11),('gallery/craft-12.jpg',12),
('gallery/craft-13.jpg',13),('gallery/craft-14.jpg',14),('gallery/craft-15.jpg',15),('gallery/craft-16.jpg',16),
('gallery/craft-17.jpg',17),('gallery/craft-18.jpg',18),('gallery/craft-19.jpg',19),('gallery/craft-20.jpg',20);
```

## Görevler

### Task 1: Galeri store + admin/public API (TDD)
`src/worker/db/gallery.ts`: `GalleryStore { list() (sort ASC, id ASC); create(r2Key, sort); updateSort(id, sort); delete(id): Promise<{r2Key} | null> }` + d1 + fake. Route'lar `src/worker/routes/gallery.ts`: PUBLIC `GET /api/gallery` → `{items:[{id, r2Key, sort}]}`; admin `POST /api/admin/gallery` (multipart `file`, media.ts upload kuralları — MIME/15MB; R2 key `gallery/<uuid>.<ext>`; sort default max+1), `PATCH /api/admin/gallery/:id {sort}`, `DELETE /api/admin/gallery/:id` (R2 delete + satır; R2 hatası satır silmeyi engellemez — media deseni). index.ts: combined middleware'e galleryStore; public mount. Migration bu task'ta eklenir + lokal migrate. Testler: list sıralı+seed'siz fake, upload happy/MIME/boyut, sort patch, delete R2 dahil + R2 hata toleransı, public auth'suz erişir, admin auth'suz 401.
Commit: `feat(gallery): admin-managed gallery with public listing (migration 0004)`

### Task 2: Public products API (TDD)
`src/worker/routes/public-products.ts` (veya products.ts'e public sub-app): PUBLIC `GET /api/products?lang=tr` → yalnız `status='published'`, sort createdAt DESC: `{products:[{slug, name, description, material, size, weightGrams, cover: r2Key|null (ilk gallery-kind medya), mediaCount}]}` — name/description istenen dil, tr fallback (server-side). PUBLIC `GET /api/products/:slug?lang=` → published değilse/yoksa 404: `{product:{slug, name, description, story, material, size, weightGrams, media:[{type, r2Key, kind}] (gallery önce, sonra process), serialNo}}`. Store'a `listPublished()` / `getBySlugPublished()` eklenir (d1+fake). Draft ürün public'ten SIZMAZ (test). Commit: `feat(products): public listing and detail endpoints with language fallback`

### Task 3: Wizard "Sitede yayınla" checkbox
AdminProductWizard Step 4: "Yayınla" / "Taslak olarak bitir" İKİLİSİ yerine → checkbox `Sitede yayınla` (varsayılan İŞARETLİ, açıklama: 'Kapatırsan ürün taslak kalır, dilediğinde ürün sayfasından yayınlarsın.') + tek `Bitir` butonu: işaretliyse publishProduct sonra listeye, değilse direkt listeye. Build/lint. Commit: `feat(admin): publish-by-default checkbox on wizard finish`

### Task 4: Admin Galeri bölümü UI
`sections.ts`'e Galeri (icon Images, ready true, path /admin/gallery, description 'Sitedeki galeri fotoğraflarının yönetimi.'). `AdminGalleryPage.tsx`: MediaUploader'a benzer ama gallery API'li bağımsız uploader (çoklu, otomatik) + grid: thumb `/api/media/<r2Key>`, ▲/▼ sort swap (PATCH ×2, try/finally refresh), sil (ConfirmDialog modal!). api.ts: listGallery/uploadGalleryImage/patchGallerySort/deleteGalleryItem. Route+barrel. Commit: `feat(admin): gallery management section`

### Task 5: Public Ürünler sayfası + ürün modal'ı + landing entegrasyonu
`src/pages/ProductsPage.tsx` (/products, PublicShell İÇİNDE): başlık, yayındaki ürünler grid'i (cover görsel `/api/media/`, ad, malzeme satırı); tıklayınca `ProductModal` (`src/components/ui/ProductModal.tsx`): büyük görsel + küçük resim şeridi (gallery+process medya), ad (font-serif), malzeme/boyut/gram satırları, açıklama+hikaye, seri no (mono, küçük). Modal: mevcut lightbox deseni (fixed overlay, X, Escape, body scroll lock — ProjectCard/GalleryPage'deki mevcut modal koduna bakılır) — ConfirmDialog değil, içerik modalı. HomePage'e `FeaturedProducts` section: son 6 yayındaki ürün, aynı modal; "Tümünü gör → /products" linki. i18n: nav.products + products sayfa başlığı/boş durum anahtarları ×3 dil (boş durum: 'Henüz yayında ürün yok.'). Commit: `feat(public): products page and product detail modal`

### Task 6: Public sayfa yeniden yapısı — galeri/SSS/iletişim/nav/biyografi söküm
- `GalleryPage` → `GET /api/gallery`'den okur (mevcut lightbox korunur); statik craft listesi kalkar.
- `GalleryPreview` (HomePage) → aynı API'den ilk 6.
- YENİ `FaqPage.tsx` (/faq): `GET /api/faqs?lang=` accordion (mevcut token/section stili); boş durum.
- YENİ `ContactPage.tsx` (/contact): mevcut `Contact` section'ı sayfa olarak sarar (section komponenti yeniden kullanılır).
- HomePage final: Hero + FeaturedProducts + GalleryPreview + Contact. `About`, `CraftStack`, `Testimonials`, `CraftSlider`, `Stats` component dosyaları + barrel kayıtları SİLİNİR; `stats` config kalkar; SEO/structuredData'da about referansı varsa temizlenir.
- Nav (config.ts): home /, products /products, gallery /gallery, faq /faq, contact /contact, verify /verify — about ÇIKAR. i18n nav anahtarları ×3 (about anahtarı navdan çıkar; nav.faq/nav.contact/nav.products eklenir).
- App.tsx: PublicShell altına /products, /faq, /contact rotaları.
Commit: `feat(public): per-nav pages, managed gallery, remove biography and static sections`

### Task 7: E2E güncelleme + tam doğrulama
- `home.spec.ts`: kaldırılan bölümlerin assert'leri çıkar (stats/craftstack); yeni: FeaturedProducts görünür (ürün yoksa boş durum kabul — test önce wizard'la ürün yayınlar), nav 6 öğe.
- `admin-content.spec.ts`: wizard bitişi checkbox'lı yeni akışa uyarlanır (Bitir → yayında).
- YENİ `public-content.spec.ts`: ürün yayınla → /products'ta görünür → tıkla modal açılır (ad görünür, Escape kapanır) → /gallery yüklenir (seed 20 foto) → /faq sayfası → admin galeriye foto yükle → /gallery'de artar → temizlik.
- Tam: unit + build + lint + tüm e2e.
Commit: `test(public): e2e for managed public content`

## Kapsam Dışı / Not
- Hero metinleri/iletişim bilgileri statik kalır (config+i18n; sonraki iterasyon: settings tablosu üzerinden yönetim).
- i18n'deki artık kullanılmayan about/craftStack/testimonials/stats metin blokları dosyalarda kalabilir (temizlik düşük öncelik).
- Ürün modal'ında paylaşım linki / ürün sayfası URL'i (deep-link /products/:slug) — sonraki iterasyon.

## Kayıtlı Karar (P45-2 review) — GÜNCELLENDİ (P4.6)
- Yayındaki ürünün seri numarası public detayda görünür → herkes /verify-serial ile sorgulayıp (varsa) alıcı adını görebilir. Kapsam genişlemesi bilinçli kabul: sitenin amacı orijinallik, alıcı adı OPSİYONEL ve Furkan bilerek girer. Alternatif (2 satırlık değişiklik, istenirse): doğrulama cevabından buyerName çıkarılır ya da public üründen serial gizlenir. Kullanıcıya soruldu — itiraz gelmezse bu hali kalır.
- GÜNCELLEME (kullanıcı kararı, P4.6): seri no public ürün sayfasından VE public API cevabından tamamen kaldırıldı (sahtecilik riski: numara kopyalanıp taklit ürüne yapıştırılabilir). Numara yalnız fiziksel kartta; buyerName zinciri de böylece fiziksel kart sahipleriyle sınırlandı.
