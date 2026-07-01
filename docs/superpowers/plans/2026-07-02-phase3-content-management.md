# Faz 3 — İçerik Yönetimi (CRUD) + Sertifika/QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Bu planda görevler Faz 2 planındaki gibi satır-satır kod içermez; kesin SÖZLEŞMELER (endpoint, doğrulama matrisi, dosya haritası, test listesi) içerir — implementer'lar mevcut Faz 2 kalıplarını birebir izler (AuthStore/fake-store deseni, Hono sub-app deseni, admin UI token/dil kuralları).

**Goal:** Admin panelindeki dört bölümü işlevsel yapmak: Ürünler (CRUD + çeviri + R2 medya), Süreç & Hikaye (ürün başına adımlar), SSS (CRUD + çeviri + sıralama), Sertifikalar (üretim + QR + public doğrulama sayfası).

**Architecture:** Faz 2 desenlerinin devamı. Her kaynak için: `src/worker/db/<resource>.ts` (Store arayüzü + `d1XStore`), `src/worker/test/fake-<resource>-store.ts`, `src/worker/routes/<resource>.ts` (Hono sub-app), route testleri fake store ile. Admin API'leri `/api/admin/*` altında (mevcut `requireAuth` korur); public okuma API'leri `/api/*` altında açık. Medya R2'da (`MEDIA` binding), `/api/media/<r2-key>` üzerinden stream edilir. Sertifika doğrulaması public `/verify/:token` SPA rotası + `GET /api/verify/:token`.

**Tech Stack:** Mevcut yığın + YENİ bağımlılık: `qrcode` (+ dev: `@types/qrcode`) — sertifika QR görselleri için (admin tarafında data-URL üretimi). Başka yeni bağımlılık YOK.

## Global Constraints

- Migration additive: `0001_init.sql` DEĞİŞMEZ; bu fazda YENİ migration GEREKMEZ (şema yeterli).
- Süreç adımları ŞEMA GEREĞİ ürüne bağlıdır (`process_steps.product_id NOT NULL`) — global adım yok. Adımlar bu fazda METİN-tabanlı (image_r2_key NULL bırakılır; görsel bağlama sonraki iterasyon).
- PDF üretimi bu fazda YOK — public doğrulama sayfası yazdırılabilir tasarlanır (tarayıcı Print → PDF). Plan notu olarak kalır.
- Public site (HomePage/GalleryPage) bu fazda D1/R2'dan OKUMAZ — o ayrı iterasyon. Bu faz yalnız admin CRUD + public verify/faq/media endpoint'leri.
- Fiyat `price` INTEGER = TL tam sayı (kuruş yok). UI'da "₺" ile gösterilir, boş bırakılabilir.
- Dil kuralı: `tr` çevirisi zorunlu (ürün adı, SSS soru+cevap); `en`/`ar` opsiyonel.
- Worker testleri: Faz 2 deseni — vitest node env, fake store, `app.request(path, init, {})`. Multipart upload testi: `FormData` + `File` (Node 24 global) ile.
- Admin UI: Türkçe statik etiketler, mevcut shadcn token'ları, i18n'e bağlanmaz. Mevcut `sections.ts`/`AdminLayout` düzenine uyulur.
- Hata gövdesi kalıbı: `{ error: '<kod>' }` — mevcut kodlarla tutarlı (`invalid_request`, `not_found`, `slug_taken`, `serial_taken`, `tr_name_required`, `tr_qa_required`, `invalid_status`, `invalid_file`, `file_too_large`, `product_not_sold`).
- Her task sonunda `npm run test && npm run build` yeşil; commit mesajları `feat(products): ...`, `feat(faq): ...`, `feat(certs): ...`, `feat(media): ...` stilinde.
- API istemcisi deseni: `src/pages/admin/api.ts`'teki gibi — `credentials: 'same-origin'`, hata kodu propagasyonu, fetch reddi → `{ ok:false, error:'network' }`.

## Dosya Haritası

```
src/worker/
  db/products.ts + test/fake-product-store.ts     (Task 1)
  routes/products.ts + products.test.ts            (Task 1)
  routes/media.ts + media.test.ts                  (Task 2)  # upload + public serve
  db/faqs.ts + test/fake-faq-store.ts              (Task 4)
  routes/faqs.ts + faqs.test.ts                    (Task 4)
  db/certificates.ts + test/fake-cert-store.ts     (Task 5)
  routes/certificates.ts + certificates.test.ts    (Task 5)
  index.ts                                         (Task 1,2,4,5'te genişler)
src/pages/admin/
  api.ts                                           (her UI task'ında genişler)
  AdminProductsPage.tsx                            (Task 6)  # liste
  AdminProductEditPage.tsx                         (Task 6 detay+çeviri, Task 7 medya+süreç)
  AdminProcessPage.tsx                             (Task 7)  # Süreç & Hikaye bölümü
  AdminFaqPage.tsx                                 (Task 8)
  AdminCertificatesPage.tsx                        (Task 9)
  sections.ts                                      (ready bayrakları task'larla true olur)
src/pages/VerifyPage.tsx                           (Task 9)  # public /verify/:token
src/App.tsx                                        (Task 6,7,8,9'da rotalar)
tests/e2e/admin-content.spec.ts                    (Task 10)
```

---

### Task 1: Products API (store + routes, TDD)

**Store arayüzü (`src/worker/db/products.ts`):**

```ts
export type ProductStatus = 'draft' | 'published' | 'sold'
export type Lang = 'tr' | 'en' | 'ar'
export interface ProductListItem {
  id: number; slug: string; serialNo: string | null; status: ProductStatus
  name: string | null            // tr çevirisinden
  price: number | null; mediaCount: number; createdAt: number
}
export interface ProductTranslation { name: string | null; description: string | null; story: string | null }
export interface ProductMediaItem {
  id: number; type: 'image' | 'video'; r2Key: string
  kind: 'gallery' | 'raw_material' | 'process'; sort: number
}
export interface ProcessStep { id: number; sort: number; texts: Partial<Record<Lang, string>> }
export interface ProductDetail {
  id: number; slug: string; serialNo: string | null; status: ProductStatus
  material: string | null; size: string | null; price: number | null
  createdAt: number; updatedAt: number
  translations: Partial<Record<Lang, ProductTranslation>>
  media: ProductMediaItem[]; steps: ProcessStep[]
}
export interface ProductInput {
  slug: string; serialNo?: string | null; status: ProductStatus
  material?: string | null; size?: string | null; price?: number | null
  translations: Partial<Record<Lang, ProductTranslation>>   // tr.name zorunluluğu route katmanında
}
export interface ProductStore {
  list(): Promise<ProductListItem[]>
  get(id: number): Promise<ProductDetail | null>
  findBySlug(slug: string): Promise<{ id: number } | null>
  findBySerial(serialNo: string): Promise<{ id: number } | null>
  create(input: ProductInput): Promise<ProductDetail>
  update(id: number, input: ProductInput): Promise<ProductDetail | null>  // translations REPLACE edilir
  delete(id: number): Promise<boolean>
  // Süreç adımları (Task 3'te route'lanır ama arayüz burada tanımlanır):
  addStep(productId: number, texts: Partial<Record<Lang, string>>, sort: number): Promise<ProcessStep>
  updateStep(stepId: number, texts: Partial<Record<Lang, string>>, sort: number): Promise<ProcessStep | null>
  deleteStep(stepId: number): Promise<boolean>
  // Medya satırları (Task 2 kullanır):
  addMedia(productId: number, m: { type: 'image'|'video'; r2Key: string; kind: string; sort: number }): Promise<ProductMediaItem>
  getMedia(mediaId: number): Promise<(ProductMediaItem & { productId: number }) | null>
  updateMedia(mediaId: number, patch: { kind?: string; sort?: number }): Promise<ProductMediaItem | null>
  deleteMedia(mediaId: number): Promise<boolean>
}
export function d1ProductStore(db: D1Database): ProductStore
```

D1 notları: `update` çevirileri `DELETE FROM product_translations WHERE product_id=? ` + yeniden INSERT ile değiştirir; `updated_at = unixepoch()` set edilir. `list` tr adını `LEFT JOIN product_translations ... lang='tr'`, medya sayısını `LEFT JOIN (SELECT product_id, COUNT(*) ...)` ile alır. Fake store aynı semantiği in-memory uygular (Faz 2 `fake-auth-store` deseni; `steps`/`media`/`translations` iç Map/Array'lerini test erişimi için expose eder).

**Route sözleşmesi (`src/worker/routes/products.ts` → mount `/api/admin/products`):**

| Endpoint | Davranış |
|---|---|
| `GET /` | 200 `{ products: ProductListItem[] }` |
| `POST /` | Doğrulama (aşağıda) → 201 `ProductDetail` |
| `GET /:id` | 200 `ProductDetail` / 404 `not_found` (id sayı değilse 400 `invalid_request`) |
| `PUT /:id` | Doğrulama → 200 `ProductDetail` / 404 |
| `DELETE /:id` | 200 `{ ok: true }` / 404 (D1 CASCADE çevirileri/medyayı/adımları siler; R2 nesneleri Task 2'deki deleteAllForProduct ile temizlenir — bkz. Task 2 sözleşmesi) |

**Doğrulama matrisi (POST/PUT ortak; non-object gövde guard'ı Faz 2 kalıbıyla):**
- `slug`: zorunlu, `/^[a-z0-9-]{1,64}$/` değilse 400 `invalid_request`; başka üründe varsa 409 `slug_taken`
- `status`: `draft|published|sold` değilse 400 `invalid_status`
- `serialNo`: verilmişse trim'lenir; boş string → null; başka üründe varsa 409 `serial_taken`
- `price`: verilmişse `Number.isInteger && >= 0` değilse 400 `invalid_request`
- `translations.tr.name`: boş/eksikse 400 `tr_name_required`
- `material`/`size`: opsiyonel string, trim

**Test listesi (fake store ile, en az):** create-happy(201+detail döner), slug format reddi, slug çakışması 409, serial çakışması 409 (kendi kaydını PUT'ta hariç tutar), tr_name_required, invalid_status, price negatif reddi, GET liste (tr adı + mediaCount), GET 404, PUT çeviri REPLACE (en silinip tr kalması), DELETE sonrası GET 404, auth'suz erişim 401 (index.ts guard'ı — Task 1'de index'e mount edilir ve mevcut `requireAuth` zinciri doğrulanır).

**index.ts:** `/api/admin/products` altına store middleware (`d1ProductStore(c.env.DB)`, `c.set('productStore', ...)`) + `app.route`. `AuthEnv` Variables genişletmesi yerine yeni tip: route dosyası kendi `ProductsEnv` tipini export eder (Faz 2 `AuthEnv` deseni).

Commit: `feat(products): products CRUD API with translations (store + routes, TDD)`

---

### Task 2: Medya API — R2 upload + public serve (TDD)

**Route sözleşmesi (`src/worker/routes/media.ts`):**

| Endpoint | Mount | Davranış |
|---|---|---|
| `POST /api/admin/products/:id/media` | admin (korumalı) | multipart form: `file` (File, zorunlu), `kind` (`gallery|raw_material|process`, default `gallery`). Ürün yoksa 404. İzinli tipler: `image/jpeg image/png image/webp` → type `image`; `video/mp4` → type `video`; aksi 400 `invalid_file`. Boyut > 15 MB → 400 `file_too_large`. R2 key: `products/<productId>/<crypto.randomUUID()>.<uzantı>` (uzantı MIME'den: jpg/png/webp/mp4). `MEDIA.put(key, file.stream(), { httpMetadata: { contentType } })` + `store.addMedia` → 201 `ProductMediaItem`. |
| `PATCH /api/admin/media/:id` | admin | JSON `{ kind?, sort? }` doğrula → 200 güncel item / 404 |
| `DELETE /api/admin/media/:id` | admin | R2 `delete(r2Key)` + satır sil → 200 `{ ok:true }` / 404 |
| `GET /api/media/*` | PUBLIC | Yıldız path = R2 key (`c.req.path.replace('/api/media/','')`). `MEDIA.get(key)` null → 404. 200 + body stream + `Content-Type` (httpMetadata) + `Cache-Control: public, max-age=31536000, immutable` + `ETag`. Path `..` içeriyorsa 400. |

**Ürün silme R2 temizliği:** `DELETE /api/admin/products/:id` (Task 1 route'u) bu task'ta genişletilir: silmeden önce ürünün media listesindeki tüm `r2Key`'ler için `MEDIA.delete(keys)` (R2 binding çoklu delete kabul eder) çağrılır. Route, `MEDIA`'ya `c.env.MEDIA` üzerinden erişir.

**Testler (fake ProductStore + in-memory fake R2):** Fake R2, `put/get/delete` olan basit sınıf (`Map<string, {body: ArrayBuffer, contentType}>`) — testte `c.env.MEDIA` olarak enjekte edilir (`app.request(path, init, { MEDIA: fakeR2 as unknown as R2Bucket })`). En az: upload-happy (201, R2'da nesne var, key şeması doğru), yanlış MIME 400, boyut aşımı 400 (küçük limitle test etmek için boyut kontrolü `file.size` üzerinden — 15MB sabiti route'ta `MAX_UPLOAD_BYTES` const), ürün yok 404, public GET 200 + doğru content-type + cache header, public GET bilinmeyen key 404, path traversal 400, DELETE media R2'dan da siler, ürün DELETE tüm R2 nesnelerini siler.

Commit: `feat(media): R2 upload for product media and public media serving`

---

### Task 3: Süreç adımları API (TDD)

**Route sözleşmesi (products.ts içine eklenir; store arayüzü Task 1'de hazır):**

| Endpoint | Davranış |
|---|---|
| `POST /api/admin/products/:id/steps` | JSON `{ texts: { tr?, en?, ar? }, sort? }`; `texts.tr` boşsa 400 `invalid_request`; ürün yoksa 404 → 201 `ProcessStep` |
| `PUT /api/admin/steps/:stepId` | Aynı doğrulama → 200 / 404 |
| `DELETE /api/admin/steps/:stepId` | 200 `{ ok:true }` / 404 |

`sort` verilmezse mevcut adım sayısı (sona ekleme). Adımlar `GET /api/admin/products/:id` detayında `steps[]` olarak zaten döner (Task 1).

**Testler:** ekle-happy (sort otomatik artar), tr zorunlu, ürün yok 404, güncelle (texts replace + sort değişimi), sil, silinen step 404.

Commit: `feat(products): per-product process steps endpoints`

---

### Task 4: SSS API (TDD)

**Store (`src/worker/db/faqs.ts`):**

```ts
export interface FaqTranslation { question: string | null; answer: string | null }
export interface Faq { id: number; sort: number; translations: Partial<Record<Lang, FaqTranslation>> }
export interface FaqStore {
  list(): Promise<Faq[]>                                    // sort ASC, id ASC
  create(sort: number, tr: Partial<Record<Lang, FaqTranslation>>): Promise<Faq>
  update(id: number, sort: number, tr: Partial<Record<Lang, FaqTranslation>>): Promise<Faq | null>  // translations REPLACE
  delete(id: number): Promise<boolean>
}
```

**Route sözleşmesi (`src/worker/routes/faqs.ts`):**

| Endpoint | Mount | Davranış |
|---|---|---|
| `GET /api/admin/faqs` | admin | 200 `{ faqs: Faq[] }` |
| `POST /api/admin/faqs` | admin | `translations.tr.question` VE `.answer` boşsa 400 `tr_qa_required`; `sort` yoksa sona → 201 |
| `PUT /api/admin/faqs/:id` | admin | aynı doğrulama → 200 / 404 |
| `DELETE /api/admin/faqs/:id` | admin | 200 / 404 |
| `GET /api/faqs?lang=tr` | PUBLIC | 200 `{ faqs: [{ id, question, answer }] }` — istenen dil, boşsa tr fallback; `lang` geçersizse tr |

**Testler:** create-happy, tr_qa_required (soru var cevap yok dahil), sıralı liste, update replace, delete, public endpoint dil fallback (en istenmiş ama sadece tr var → tr metni döner), public geçersiz lang → tr.

Commit: `feat(faq): FAQ CRUD API with translations and public listing`

---

### Task 5: Sertifika API (TDD)

**Store (`src/worker/db/certificates.ts`):**

```ts
export interface Certificate {
  id: number; productId: number; serialNo: string; qrToken: string
  buyerName: string | null; issuedAt: number
  productName?: string | null; productSlug?: string | null   // list/verify join'i
}
export interface CertStore {
  list(): Promise<Certificate[]>                              // issuedAt DESC, ürün tr adı join'li
  create(productId: number, serialNo: string, qrToken: string, buyerName: string | null): Promise<Certificate>
  delete(id: number): Promise<boolean>
  findByToken(token: string): Promise<(Certificate & { material: string|null; size: string|null }) | null>
}
```

**Route sözleşmesi (`src/worker/routes/certificates.ts`):**

| Endpoint | Mount | Davranış |
|---|---|---|
| `GET /api/admin/certificates` | admin | 200 `{ certificates: Certificate[] }` |
| `POST /api/admin/certificates` | admin | JSON `{ productId, buyerName? }`. Ürün yok → 404 `not_found`; `product.status !== 'sold'` → 400 `product_not_sold`; `serialNo` = ürünün serial_no'su, ürün serial'i null ise 400 `invalid_request` (UI kullanıcıya "önce ürüne seri no ver" der). `qrToken` = 16 bayt base64url (`newSessionId` DEĞİL — ayrı util `newToken()` aynı dosyada). → 201 Certificate |
| `DELETE /api/admin/certificates/:id` | admin | 200 / 404 |
| `GET /api/verify/:token` | PUBLIC | 200 `{ valid: true, certificate: { serialNo, buyerName, issuedAt, product: { name, slug, material, size } } }` / 404 `{ valid: false }` |

Sertifika oluşturma ProductStore'a da ihtiyaç duyar (ürün status/serial kontrolü) — route env'inde iki store da bulunur (index.ts middleware'i ikisini de set eder).

**Testler:** create-happy (token benzersiz, serial kopyalanır), sold değil 400, serial yok 400, ürün yok 404, list join'li, verify-happy (valid:true + ürün alanları), verify bilinmeyen token 404 valid:false, delete.

Commit: `feat(certs): certificate issuance API and public verification endpoint`

---

### Task 6: Admin UI — Ürün listesi + detay/çeviri formu

**`api.ts` eklentileri:** `listProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct` (Faz 2 kalıbı; dönüşler `{ok:true, data}|{ok:false, error}`).

**`AdminProductsPage.tsx` (`/admin/products`):** başlık + "Yeni ürün" butonu → `/admin/products/new`. Tablo: Ad (tr, yoksa slug italik), Slug, Durum (rozet: draft=nötr "Taslak", published=primary "Yayında", sold=outline "Satıldı"), Fiyat (₺ / —), Medya (sayı), satır → `/admin/products/:id`. Boş durum: "Henüz ürün yok" + yeni ürün CTA. Yükleniyor/hata durumları.

**`AdminProductEditPage.tsx` (`/admin/products/new` ve `/admin/products/:id`):**
- **Detaylar bölümü:** slug (input, pattern hint), seri no, durum (select), malzeme, boyut, fiyat (number). 
- **Çeviriler bölümü:** tr/en/ar sekmeleri (buton grubu state'i); alanlar: Ad, Açıklama (textarea), Hikaye (textarea). tr sekmesinde "zorunlu" işareti.
- **Kaydet:** tek buton → create'te başarıda `/admin/products/:id`'ye navigate; update'te "Kaydedildi" status mesajı. Hata kodu eşlemesi: `slug_taken`: 'Bu slug başka bir üründe kullanılıyor.', `serial_taken`: 'Bu seri numarası başka bir üründe.', `tr_name_required`: 'Türkçe ürün adı zorunlu.', `invalid_status`/`invalid_request`/`network`/`unknown` benzer şekilde.
- **Sil:** düzenleme modunda "Ürünü sil" (destructive, `confirm()` ile) → listeye dön.
- Medya ve Süreç bölümleri bu task'ta "Task 7'de" yer tutucu DEĞİL — hiç render edilmez (Task 7 ekler).

**`sections.ts`:** products `ready: true`. **App.tsx:** `/admin/products`, `/admin/products/new`, `/admin/products/:id` rotaları (coming-soon map'inden products çıkar — map `contentSections.filter(s => !s.ready)` olur, böylece sonraki task'lar sadece sections.ts değiştirir).

Doğrulama: build + lint + mevcut e2e. Commit: `feat(admin): products list and edit pages with translations`

---

### Task 7: Admin UI — Medya yöneticisi + Süreç editörü

**`api.ts` eklentileri:** `uploadProductMedia(productId, file, kind)` (FormData; fetch, JSON değil), `patchMedia`, `deleteMedia`, `addStep`, `updateStep`, `deleteStep`.

**AdminProductEditPage'e iki bölüm eklenir (yalnız düzenleme modunda, `new`'de görünmez):**
- **Medya:** dosya input (`accept="image/jpeg,image/png,image/webp,video/mp4"`) + tür seçici (`gallery|raw_material|process` → "Galeri | Hammadde | Süreç") + yükle butonu (busy durumu). Grid: thumb (`/api/media/<r2Key>`; video ise `<video muted>` küçük önizleme), tür etiketi, sil butonu (confirm). Yükleme/silme anında API'ye gider, liste yenilenir. Hata eşlemesi: `invalid_file`: 'Desteklenmeyen dosya türü (JPEG/PNG/WebP/MP4).', `file_too_large`: 'Dosya 15 MB sınırını aşıyor.'
- **Süreç & Hikaye:** adım listesi (sort sırasıyla): tr metni (ana), en/ar açılır alanlar; her adımda kaydet/sil; yukarı/aşağı ok = sort swap (iki `updateStep` çağrısı); "Adım ekle" formu (tr zorunlu).

**`AdminProcessPage.tsx` (`/admin/process`):** açıklama ("Süreç adımları ürüne bağlıdır") + ürün listesi (ad + adım sayısı `getProduct` değil listten değil — liste endpoint'i adım sayısı vermez; kabul: sadece ürün adları listelenir, tıklayınca `/admin/products/:id`'ye gider; sayfa kısa tutulur). **`sections.ts`:** process `ready: true`.

Doğrulama: build + lint. Commit: `feat(admin): product media manager and process steps editor`

---

### Task 8: Admin UI — SSS yöneticisi

**`api.ts`:** `listFaqs`, `createFaq`, `updateFaq`, `deleteFaq`.

**`AdminFaqPage.tsx` (`/admin/faq`):** sıralı liste; her öğe: tr sorusu başlık, genişleyince üç dil için soru+cevap alanları ve kaydet/sil; yukarı/aşağı sıralama (sort swap, iki `updateFaq`); en üstte "Soru ekle" formu (tr soru+cevap zorunlu). Hata eşlemesi `tr_qa_required`: 'Türkçe soru ve cevap zorunlu.' **`sections.ts`:** faq `ready: true`. **App.tsx** rotası zaten filter'la düşer.

Doğrulama: build + lint. Commit: `feat(admin): FAQ management page`

---

### Task 9: Sertifikalar UI + QR + public doğrulama sayfası

**Bağımlılık:** `npm i qrcode && npm i -D @types/qrcode` (tek yeni runtime dep; lisans MIT).

**`api.ts`:** `listCertificates`, `createCertificate`, `deleteCertificate` (admin); public verify UI kendi fetch'ini yapar.

**`AdminCertificatesPage.tsx` (`/admin/certificates`):**
- "Sertifika oluştur" formu: ürün seçici (`listProducts`'tan `status==='sold'` olanlar; hiç yoksa bilgi metni: 'Sertifika için önce bir ürünü "Satıldı" durumuna al.'), alıcı adı (opsiyonel) → create. Hata eşlemesi: `product_not_sold`, `invalid_request` ('Ürünün seri numarası yok. Önce ürün kartına seri no ekle.').
- Liste: seri no (mono), ürün adı, alıcı, tarih (`new Date(issuedAt*1000).toLocaleDateString('tr-TR')`), **QR görseli** (`qrcode`'un `toDataURL(verifyUrl, { margin: 1, width: 96 })` — `verifyUrl = location.origin + '/verify/' + qrToken`), "Doğrulama sayfası" linki (yeni sekme), "İndir" (data URL'i `<a download>`), sil (confirm).

**`src/pages/VerifyPage.tsx` (public `/verify/:token`, App.tsx'te PublicShell DIŞINDA bağımsız rota):** `GET /api/verify/:token`. Geçerli: logo + "Orijinallik Sertifikası" (font-serif), ürün adı, seri no (mono, büyük), malzeme/boyut, alıcı (varsa), veriliş tarihi, "Bu ürün Furkan Çiçekli atölyesinde el işçiliğiyle üretilmiştir." + `@media print` uyumlu sade düzen (print'te nav yok zaten). Geçersiz: "Sertifika bulunamadı" + açıklama. Yükleniyor durumu. Sayfa `lang=tr` statik Türkçe (public ama sertifika dili Türkçe — not: çok dillilik sonraki iterasyon).

**`sections.ts`:** certificates `ready: true`.

Doğrulama: build + lint. Commit: `feat(certs): certificates admin page with QR and public verify page`

---

### Task 10: E2E genişletme + tam doğrulama

**`tests/e2e/admin-content.spec.ts`:** Login'li akış — `.dev.vars` yerine test kendi admin'ini bootstrap'layamaz; bu yüzden test önce `POST /api/auth/login`'i UI'dan dener: `admin@local.test` yoksa test `test.skip` OLMAZ — bunun yerine spec başında `request` fixture ile `POST /api/auth/login` denenir ve 401 gelirse anlamlı hata mesajıyla fail edilir (yerelde `.dev.vars` + bootstrap ile yeşil; CI'da e2e zaten koşmuyor). Akış testleri:
1. login → `/admin/products` → "Yeni ürün" → slug+tr ad doldur → kaydet → listede görünür.
2. üründe durum "Satıldı" + seri no ver → kaydet → `/admin/certificates` → ürünü seç → oluştur → listede QR `<img>` görünür.
3. QR satırındaki doğrulama linkinin href'inden token alınır → `/verify/<token>` yeni sayfada "Orijinallik Sertifikası" görünür; `/verify/gecersiz-token` → "Sertifika bulunamadı".
4. `/admin/faq` → soru ekle (tr) → listede görünür → sil.
Temizlik: test sonunda oluşturulan ürün silinir (UI'dan) — sertifika CASCADE ile gider.

**Tam doğrulama:** `npm run test && npm run build && npx playwright test` (hepsi) + `npx eslint src/ tests/` branch'in main'e ekstra sorun eklemediği kontrolü.

Commit: `test(admin): e2e flows for product, certificate+verify, faq`

---

## Deploy Sonrası Notlar (kod dışı)
- R2 bucket üretimde zaten var (`furkancicekli-media`); medya yükleme deploy sonrası çalışır.
- Sonraki iterasyonlar: public sitenin ürünleri D1/R2'dan okuması (ürün detay sayfaları), süreç adımlarına görsel bağlama, sertifika PDF/çok dillilik, galeri medya sıralama UI'ı (patchMedia hazır).

## Kayıtlı Tasarım Kararları (final review)
- `/api/verify/:token` alıcı adını (buyerName) token'ı bilen herkese gösterir — bilinçli karar: token, sertifikanın üstüne basılan yetki-URL'sidir (capability URL); sertifika sahibi kimin adına kesildiğini görmelidir. Alıcı adı girmek opsiyoneldir.
- `/api/media/*` taslak (draft) ürün medyasını da servis eder — anahtarlar sunucu-üretimi UUID olduğundan tahmin edilemez; public sitede taslak ürünler listelenmediği sürece pratik sızıntı yoktur.
