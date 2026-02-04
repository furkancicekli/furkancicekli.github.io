# Furkan Çiçekli - Tesbih Ustası Portfolio

Kişisel portfolio web sitesi. Modern, minimal ve mobil öncelikli tasarım.

## Site Yapısı

```
furkancicekli.github.io/
├── index.html          # Ana sayfa
├── css/
│   └── main.css        # Tüm stiller
├── js/
│   └── main.js         # JavaScript (slider, galeri, menü)
└── images/
    ├── hero/           # Ana sayfa büyük fotoğraf
    ├── about/          # Hakkımda slider fotoğrafları
    ├── gallery/        # Çalışmalarım galeri fotoğrafları
    ├── logo.png        # Site logosu
    └── favicon.png     # Tarayıcı ikonu
```

## Fotoğraf Güncelleme

### Hero Fotoğrafı (Ana Sayfa)
1. `images/hero/` klasörüne gidin
2. Yeni fotoğrafınızı `1.jpeg` olarak kaydedin

### Hakkımda Slider
1. `images/about/` klasörüne fotoğraf ekleyin (1.jpeg, 2.jpeg, 3.jpeg...)
2. `js/main.js` dosyasını açın
3. `CONFIG.aboutSlider.count` değerini güncelleyin

```javascript
aboutSlider: {
    folder: 'images/about/',
    count: 3,  // ← Bu sayıyı değiştirin
    extension: 'jpeg'
}
```

### Çalışmalarım Galerisi
1. `images/gallery/` klasörüne fotoğraf ekleyin (1.jpeg, 2.jpeg...)
2. `js/main.js` dosyasını açın
3. `CONFIG.gallery.count` değerini güncelleyin

```javascript
gallery: {
    folder: 'images/gallery/',
    count: 6,  // ← Bu sayıyı değiştirin
    extension: 'jpeg'
}
```

> Her klasörün içinde detaylı README.md dosyası bulunur.

## Metin Güncelleme

Tüm metinler `index.html` dosyasında. Düzenlemek istediğiniz bölümü bulun:

- **Hero Bölümü**: "Tesbih Ustası" başlığı ve açıklama
- **Hakkımda**: Kendinizi tanıtan paragraflar
- **Müşteri Yorumları**: `.testimonial-card` içindeki metinler
- **İletişim**: E-posta ve telefon bilgileri

## Renk Değiştirme

`css/main.css` dosyasının başındaki `:root` bölümünde:

```css
:root {
    --primary: #e63946;      /* Ana renk (kırmızı) */
    --primary-dark: #c1121f; /* Koyu varyant */
    /* ... */
}
```

## İletişim Bilgileri

`index.html` dosyasında aşağıdaki yerleri güncelleyin:

1. **Footer e-posta**: `.footer-email` class'ı
2. **WhatsApp butonu**: `href="https://wa.me/905..."` linkini değiştirin
3. **Instagram**: `href="https://instagram.com/..."` linkini değiştirin

## SEO Güncelleme

`index.html` dosyasının `<head>` bölümünde:

- `<title>` etiketini değiştirin
- `<meta name="description">` içeriğini güncelleyin
- Schema.org JSON-LD verisini güncelleyin (script type="application/ld+json")

## Yayınlama

Değişiklikler GitHub'a push edildiğinde otomatik olarak yayınlanır:

```bash
git add .
git commit -m "Açıklama"
git push
```

Site adresi: https://furkancicekli.github.io

## Teknik Bilgiler

- **Framework**: Vanilla HTML/CSS/JS (bağımlılık yok)
- **Responsive**: Mobile-first yaklaşım (768px breakpoint)
- **Performans**: Lazy loading, minimal CSS/JS
- **SEO**: Schema.org, Open Graph, Twitter Cards

## Destek

Sorularınız için: [GitHub Issues](https://github.com/furkancicekli/furkancicekli.github.io/issues)
