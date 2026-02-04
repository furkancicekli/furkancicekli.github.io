/**
 * Furkan Çiçekli Portfolio
 * Main JavaScript
 */

// Fotoğraf sayıları - YENİ FOTOĞRAF EKLEDİĞİNİZDE BURAYA GÜNCELLE
const CONFIG = {
    aboutSlider: {
        folder: 'images/about/',
        count: 3,  // about klasöründeki fotoğraf sayısı (1.jpeg, 2.jpeg, 3.jpeg...)
        extension: 'jpeg'
    },
    gallery: {
        folder: 'images/gallery/',
        count: 6,  // gallery klasöründeki fotoğraf sayısı
        extension: 'jpeg'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initSmoothScroll();
    initAboutSlider();
    initGallery();
});

/**
 * Mobile Menu
 */
function initMobileMenu() {
    const toggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');

    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Link tıklandığında menüyü kapat
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            toggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // Dışarı tıklandığında menüyü kapat
    document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
            toggle.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });
}

/**
 * Smooth Scroll
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 70;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}

/**
 * About Section Slider
 * images/about/ klasöründeki fotoğrafları yükler
 */
function initAboutSlider() {
    const container = document.getElementById('sliderContainer');
    const prevBtn = document.getElementById('sliderPrev');
    const nextBtn = document.getElementById('sliderNext');

    if (!container) return;

    let currentSlide = 0;
    const { folder, count, extension } = CONFIG.aboutSlider;

    // Fotoğrafları yükle
    for (let i = 1; i <= count; i++) {
        const img = document.createElement('img');
        img.src = `${folder}${i}.${extension}`;
        img.alt = `Tesbih çalışması ${i}`;
        img.loading = 'lazy';
        container.appendChild(img);
    }

    function updateSlider() {
        container.style.transform = `translateX(-${currentSlide * 100}%)`;
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentSlide = currentSlide > 0 ? currentSlide - 1 : count - 1;
            updateSlider();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentSlide = currentSlide < count - 1 ? currentSlide + 1 : 0;
            updateSlider();
        });
    }

    // Otomatik geçiş (5 saniye)
    setInterval(() => {
        currentSlide = currentSlide < count - 1 ? currentSlide + 1 : 0;
        updateSlider();
    }, 5000);
}

/**
 * Gallery Grid
 * images/gallery/ klasöründeki fotoğrafları yükler
 */
function initGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    const { folder, count, extension } = CONFIG.gallery;

    for (let i = 1; i <= count; i++) {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const img = document.createElement('img');
        img.src = `${folder}${i}.${extension}`;
        img.alt = `Tesbih ${i}`;
        img.loading = 'lazy';

        item.appendChild(img);
        grid.appendChild(item);
    }
}
