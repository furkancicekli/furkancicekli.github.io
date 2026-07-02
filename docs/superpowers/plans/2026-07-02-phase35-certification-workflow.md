# Faz 3.5 — Sertifikasyon İş Akışı Yeniden Tasarımı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Sözleşme-bazlı plan (Faz 3 gibi); implementer'lar mevcut kalıpları izler.

**Goal:** Admin panelini Furkan'ın gerçek iş akışına uydurmak: ürün eklenir eklenmez otomatik sertifika + otomatik seri no/slug, wizard'lı ekleme, malzeme kataloğu, gram alanı; fiyat/durum-seçimi/süreç-adımları kaldırılır; public sertifika numarası sorgulama eklenir.

**Müşteri bağlamı (tasarımı yönlendiren):** Furkan tesbihleri çoğunlukla başka tesbihçilerin siparişiyle üretir; satışla uğraşmaz. Sitenin ana amacı sertifikalamadır: ürünle birlikte sertifika (şimdilik eldeki kartvizite ELLE yazılan numara) gönderilir. Alıcı sitede numarayı sorgular. İleride: toplu numara ön-üretimi + basılı kart eşleştirme (bu fazda DEĞİL — tasarım buna kapı bırakır).

## Global Constraints

- Migration additive: YENİ `migrations/0002_certification.sql` eklenir (aşağıda); 0001 DEĞİŞMEZ. Süreç adımı tabloları ve `products.price`/`status='sold'` DB'de kalır (kullanılmaz — veri kaybı yok, geri dönüş mümkün).
- **Seri no algoritması** (`src/worker/lib/serial.ts`): 16 hane = `YYYY` (üretim yılı, parametreyle verilir — Date.now route katmanında) + 11 rastgele hane (crypto.getRandomValues) + 1 Luhn kontrol hanesi (16 hanenin tümü Luhn-geçerli). Gösterim: 4'lü gruplar boşluklu (`2026 4829 1044 7391`). DB'de boşluksuz 16 hane saklanır. Doğrulamada girdi normalize edilir (boşluk/tire sökülür). `isValidSerial()` Luhn+format kontrolü yapar (UI ön-kontrolü); GERÇEK doğrulama daima DB lookup'tır.
- **Otomatik sertifika:** POST /api/admin/products başarısında aynı istekte sertifika da yaratılır (serial = ürün seriali, qrToken üretilir). Ürün silinince CASCADE ile gider (mevcut).
- **Slug otomatik:** tr ad'dan slugify (tr karakter fold: ç→c ğ→g ı→i ö→o ş→s ü→u; a-z0-9-); çakışmada `-XXXX` (4 rastgele [a-z0-9]) eklenir. Slug UI'da GÖSTERİLMEZ (wizard'da yok; edit'te readonly küçük metin).
- **API sözleşme değişiklikleri:** ProductInput'tan `price`, `serialNo`, `status`, `slug` ÇIKAR (server üretir/yönetir); `weightGrams?: number|null` (REAL, ≥0) ve `material?: string|null` GİRER (materials kataloğundan ad). `POST /api/admin/products/:id/publish` → status published; `POST /api/admin/products/:id/unpublish` → draft. Steps route'ları (`POST .../steps`, `PUT/DELETE /api/admin/steps/*`) KALDIRILIR (store metodları kalabilir; index mount'ları söker). Medya `kind`: UI iki alan sunar — "Ürün Fotoğrafları"=`gallery`, "Yapım Aşamaları"=`process` (raw_material enum'da kalır, UI kullanmaz).
- **Public sorgulama:** `GET /api/verify-serial/:serial` (normalize → certificates.serial_no lookup) aynı verify payload'ını döner. Public sayfa `/verify` (token'sız): numara giriş formu (Luhn ön-kontrol + hata metni) → başarıda `/verify/:token`'a navigate (API cevabına qrToken eklenir — bkz. Task 4). Public site nav'ına "Sertifika" linki (i18n tr/en/ar: "Sertifika Sorgula"/"Verify Certificate"/"التحقق من الشهادة" — mevcut i18n dosya düzenine uygun anahtarlarla).
- **Sertifika sayfası:** manuel oluşturma formu KALKAR (otomatik artık); liste kalır + buyerName inline düzenleme (`PATCH /api/admin/certificates/:id {buyerName}`) + QR/PNG indir/doğrulama linki/sil. Seri no her yerde 4'lü gruplarla gösterilir.
- Test/UI kalıpları Faz 2-3 ile aynı (fake store TDD, `{error:'<kod>'}`, Türkçe etiket, token'lar). Yeni npm bağımlılığı YOK. Her task sonunda test+build yeşil.

## migrations/0002_certification.sql

```sql
ALTER TABLE products ADD COLUMN weight_grams REAL;
CREATE TABLE materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_certificates_serial ON certificates(serial_no);
```

## Dosya Haritası

```
migrations/0002_certification.sql                 (Task 1)
src/worker/lib/serial.ts + serial.test.ts         (Task 1)  # üretim + Luhn + format/normalize/slugify
src/worker/db/materials.ts + test/fake-…          (Task 2)
src/worker/routes/materials.ts + test             (Task 2)  # GET/POST /api/admin/materials
src/worker/db/products.ts                         (Task 3)  # weightGrams; create'te serial/slug paramları
src/worker/routes/products.ts + test              (Task 3)  # yeni input sözleşmesi, auto-cert, publish/unpublish, steps route söküm
src/worker/db/certificates.ts + routes            (Task 4)  # findBySerial, PATCH buyerName, verify-serial route, verify payload'a qrToken
src/worker/index.ts                               (Task 2-4 wiring)
src/pages/admin/AdminProductWizard.tsx            (Task 5)  # 4 adımlı wizard (/admin/products/new)
src/pages/admin/AdminProductEditPage.tsx          (Task 6)  # price/status/steps söküm; gram+malzeme+publish; iki medya alanı
src/pages/admin/AdminCertificatesPage.tsx         (Task 7)  # form söküm, buyerName edit, formatlı serial
src/pages/admin/sections.ts + AdminProcessPage    (Task 6)  # Süreç bölümü kalkar (sections'tan çıkar; sayfa silinir)
src/pages/VerifyPage.tsx + src/pages/VerifyQueryPage.tsx (Task 7)  # /verify sorgu formu; formatlı serial gösterimi
src/components/layout nav + i18n tr/en/ar         (Task 7)  # "Sertifika Sorgula" nav linki
tests/e2e/admin-content.spec.ts                   (Task 8)  # yeni akışa göre yeniden yazılır
```

---

### Task 1: Migration + seri no kütüphanesi (TDD)

`migrations/0002_certification.sql` yukarıdaki gibi. Lokal migrate edilir.

`src/worker/lib/serial.ts` sözleşmesi:
```ts
export function generateSerial(year: number): string        // '2026482910447391' (16 hane, Luhn-geçerli)
export function isValidSerial(input: string): boolean        // normalize + 16 hane + Luhn
export function normalizeSerial(input: string): string       // boşluk/tire söker
export function formatSerial(serial: string): string         // '2026 4829 1044 7391'
export function slugify(name: string): string                // tr fold, a-z0-9-, boş sonuç → 'urun'
```
Testler: üretilen serinin uzunluk/prefix/Luhn doğruluğu; art arda üretimlerin farklılığı; isValid kabul/red (bozuk hane, yanlış uzunluk, boşluklu girdi kabulü); format/normalize gidiş-dönüş; slugify tr karakterler + boş/sembol girdiler.
Migration lokal uygulanır (`npm run db:migrate:local`). Commit: `feat(certs): serial number algorithm and certification schema migration`

### Task 2: Malzeme kataloğu API (TDD)

`MaterialStore { list(): Promise<{id,name}[]> (name ASC); create(name): Promise<{id,name}> }` — d1 + fake. Route'lar: `GET /api/admin/materials` → `{materials}`; `POST /api/admin/materials {name}` → trim, boş → 400 invalid_request; mevcutsa (case-insensitive) 200 MEVCUT kaydı döner (idempotent — UI "ekle"yi güvenle çağırır); yoksa 201. index.ts: kombine store middleware'ine materialStore eklenir. Testler: list sıralı, create yeni/idempotent/boş. Commit: `feat(materials): material catalog API`

### Task 3: Products API yeniden sözleşmesi + otomatik sertifika (TDD)

- ProductInput YENİ: `{ material?, size?, weightGrams?, translations }` — slug/serial/status/price yok. Doğrulama: tr.name zorunlu (mevcut kod), weightGrams verilmişse sayı ≥ 0 (REAL — integer şartı YOK) else 400, material/size trim.
- POST /: slug = slugify(tr.name) + çakışmada `-XXXX` (findBySlug döngüsü, max 5 deneme); serial = generateSerial(yıl) + findBySerial çakışma retry; status 'draft'; ürün yaratılır → certStore.create(productId, serial, newToken(), null) AYNI handler'da → 201 `ProductDetail & { certificate: {serialNo, qrToken} }`.
- PUT /:id: aynı yeni input (slug/serial/status DOKUNULMAZ); price artık asla yazılmaz.
- `POST /:id/publish` → status='published'; `POST /:id/unpublish` → 'draft'; 404 yoksa. (Store'a `setStatus(id, status)` eklenir.)
- Steps route'ları products.ts'ten ve index.ts'ten SÖKÜLÜR (testleri de silinir); `list()`/`get()` steps alanı kalabilir (boş döner).
- db/products.ts: `weight_grams` kolonu okuma/yazma (`weightGrams`); ProductListItem'a weightGrams eklenir, price kalabilir (okunmaz-yazılmaz).
- Mevcut product testleri yeni sözleşmeye göre GÜNCELLENİR (slug/serial/status/price input testleri → otomatik üretim testlerine dönüşür: create'te serial 16-hane Luhn-geçerli, slug tr-fold, cert satırı fake certStore'da oluşmuş, publish/unpublish geçişleri, weightGrams doğrulama).
Commit: `feat(products): auto serial/slug/certificate, publish action, weight; drop price/status input`

### Task 4: Sertifika API güncellemeleri (TDD)

- CertStore: `findBySerial(serial)` eklenir (normalize edilmiş 16 hane ile lookup; verify-serial route normalize eder); `updateBuyer(id, buyerName|null)`; verify payload'larına `qrToken` eklenir (findByToken/findBySerial dönüşüne).
- Route'lar: `PATCH /api/admin/certificates/:id {buyerName}` → 200/404; `GET /api/verify-serial/:serial` (PUBLIC, /api/verify yanına) → normalize → isValidSerial değilse 404 {valid:false} (format bilgisi sızdırma) → lookup → aynı verify payload + `qrToken`. `GET /api/verify/:token` cevabına da qrToken eklenir (UI tutarlılığı).
- POST /api/admin/certificates (manuel oluşturma) KALDIRILIR (otomatik akış; testleri silinir).
Commit: `feat(certs): serial lookup, buyer editing, remove manual issuance`

### Task 5: Ürün ekleme wizard'ı (UI)

`/admin/products/new` → `AdminProductWizard.tsx`. 4 adım, üstte adım göstergesi (1 Bilgiler · 2 Ürün Fotoğrafları · 3 Yapım Aşamaları · 4 Sertifika & Yayın), her adım İLERİ'de kaydeder:
1. **Bilgiler:** Ad (tr, zorunlu), Malzeme (selectbox: listMaterials + en altta "+ Yeni malzeme" seçeneği → inline input + ekle butonu → createMaterial → seçili yapılır), Gram (opsiyonel, step 0.1), Boyut (opsiyonel), Açıklama (tr, opsiyonel textarea). "Devam" → createProduct (yalnız ilk kez; dönen id state'e) veya updateProduct → adım 2.
2. **Ürün Fotoğrafları:** mevcut upload bileşeni deseni, kind='gallery' sabit; grid + sil. "Devam"/"Geri".
3. **Yapım Aşamaları:** aynısı kind='process' sabit ("Malzeme ve yapım süreci fotoğrafları"). "Devam"/"Geri".
4. **Sertifika & Yayın:** büyük formatlı seri no (formatSerial UI kopyası — util'i `src/pages/admin/serial-format.ts` olarak paylaş ya da API'den formatlı al; basitçe UI'da 4'lü grupla), QR görseli, "Doğrulama sayfası" linki, buyerName input ("Alıcı (opsiyonel)" → PATCH), iki buton: **"Yayınla"** (publish → listeye döner, status mesajı) ve **"Taslak olarak bitir"** (listeye döner).
api.ts: createProduct/updateProduct yeni sözleşmeye uyarlanır; publishProduct/unpublishProduct, listMaterials/createMaterial, patchCertificate eklenir. Kısmi tamamlanan ürün = taslak (sorun değil — kullanıcı listeden edit'le devam eder).
Commit: `feat(admin): four-step product wizard with auto certificate`

### Task 6: Edit sayfası + bölüm temizliği (UI)

- AdminProductEditPage: price alanı, durum select'i, süreç adımları bölümü SÖKÜLÜR. Eklenen: Gram, Malzeme combobox (wizard'la aynı bileşen — `MaterialSelect` ortak komponent `src/pages/admin/MaterialSelect.tsx`), durum rozeti + **Yayınla/Yayından kaldır** butonu, sertifika kutusu (formatlı serial + doğrulama linki), medya bölümü iki alt alana ayrılır (Ürün Fotoğrafları=gallery / Yapım Aşamaları=process; upload'ta kind sabit, listede filtre). Slug readonly bilgi satırı. serialNo/status API'den ProductDetail'de gelmeye devam eder (okuma).
- AdminProductsPage: Fiyat kolonu → Gram; Durum rozeti kalır (Taslak/Yayında).
- `sections.ts`: process bölümü listeden ÇIKAR; `AdminProcessPage.tsx` silinir; App.tsx rotası kalkar. Dashboard UPCOMING listesi zaten sections'tan türemiyor — AdminDashboardPage `contentSections`'ı map ettiği için otomatik düzelir (kontrol edilir).
Commit: `feat(admin): edit page aligned to certification workflow; remove process section`

### Task 7: Sertifika sayfası + public sorgulama (UI)

- AdminCertificatesPage: create formu kalkar (açıklama metni: "Sertifikalar ürün eklenince otomatik oluşturulur."), kartlarda formatlı serial (font-mono, kopyala butonu `navigator.clipboard`), buyerName inline edit (input+kaydet → PATCH), QR/PNG/doğrulama/sil aynen.
- `VerifyQueryPage.tsx` (`/verify` rotası, token'sız): başlık "Sertifika Sorgula", numara input (16 hane, boşluk toleranslı; Luhn ön-kontrolü başarısızsa 'Numara hatalı görünüyor — kontrol et.'), submit → GET /api/verify-serial → valid ise dönen qrToken ile `/verify/:token`'a navigate; değilse 'Sertifika bulunamadı.' VerifyPage'de serial formatlı gösterilir.
- Public nav: Layout nav'ına "Sertifika Sorgula" linki (`/verify`), i18n tr/en/ar anahtarlarıyla (mevcut nav item deseni izlenir; RTL sorunsuz).
Commit: `feat(certs): public serial lookup page and certificate registry polish`

### Task 8: E2E yeniden yazımı + tam doğrulama

`tests/e2e/admin-content.spec.ts` yeni akışa göre yeniden yazılır: login → wizard adım 1 (ad+malzeme ekle) → adım atlayarak 4'e (fotoğrafsız ilerleme serbest) → seri no görünür (16 hane formatlı) → Yayınla → listede "Yayında" rozeti → sertifikalar sayfasında kart var → doğrulama linki → public sayfa 'Orijinallik Sertifikası' → `/verify` sorgu sayfasında aynı numara girilince doğrulanır → yanlış numara 'bulunamadı' → SSS akışı (değişmedi, korunur) → temizlik (ürün sil). Tam doğrulama: unit+build+lint+tüm e2e.
Commit: `test(admin): e2e for certification wizard workflow`

## Kapsam Dışı / Gelecek
- Toplu sertifika numarası ön-üretimi + basılı kart eşleştirme (certificates.product_id nullable migration'ı gerektirir — ileride ayrı faz; serial algoritması buna hazır).
- Sertifika PDF/kart tasarımı baskısı; public sitenin ürünleri D1'den okuması.
