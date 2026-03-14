import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { i18n } from '../i18n.js';

function HomePage() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goToConfigurator = () => {
    navigate('/configurator');
  };

  useEffect(() => {
    document.body.classList.add('home-page-active');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear().toString();

    const FRONT_PARTS = [
      { id: 'shell', side: 'front' },
      { id: 'psButton', side: 'front' },
      { id: 'share', side: 'front' },
      { id: 'options', side: 'front' },
      { id: 'faceButtons', side: 'front' },
      { id: 'stickL', side: 'front' },
      { id: 'stickR', side: 'front' },
      { id: 'touchpad', side: 'front' },
      { id: 'bumpers', side: 'front' },
      { id: 'trimpiece', side: 'front' }
    ];

    const BACK_PARTS = [
      { id: 'backShellMain', side: 'back' },
      { id: 'backHandles', side: 'back' },
      { id: 'backTriggers', side: 'back' }
    ];

    const ALL_PARTS = [...FRONT_PARTS, ...BACK_PARTS];

    const PRICES = {
      psButton: 4.0,
      share: 3.0,
      options: 3.0,
      faceButtons: 6.0,
      stickL: 5.0,
      stickR: 5.0,
      touchpad: 10.0,
      bumpers: 8.0,
      trimpiece: 12.0,
      shell: 15.0,
      backShellMain: 15.0,
      backHandles: 10.0,
      backTriggers: 8.0
    };

    const SHELL_PART_IDS = new Set([
      'shell',
      'trimpiece',
      'backShellMain',
      'backHandles'
    ]);

    const SHELL_COLORS = [
      { hex: '#FF7A21', name_en: 'Orange', name_ar: 'برتقالي' },
      { hex: '#E6D63A', name_en: 'Yellow', name_ar: 'أصفر' },
      { hex: '#6ECFFF', name_en: 'Light Blue', name_ar: 'أزرق فاتح' },
      { hex: '#8E8E8E', name_en: 'Steel Gray', name_ar: 'رمادي معدني' },
      { hex: '#0C4BFF', name_en: 'Blue', name_ar: 'أزرق' },
      { hex: '#001F63', name_en: 'Midnight Blue', name_ar: 'أزرق داكن' },
      { hex: '#C2185B', name_en: 'Magenta', name_ar: 'ماجنتا' },
      { hex: '#F5F5F5', name_en: 'Soft White', name_ar: 'أبيض ناعم' },
      { hex: '#D400A8', name_en: 'Hot Pink', name_ar: 'وردي فاقع' },
      { hex: '#0A0A0A', name_en: 'Matte Black', name_ar: 'أسود مطفي' }
    ];

    const ACCESSORY_COLORS = [
      { hex: '#0A0A0A', name_en: 'Black', name_ar: 'أسود' },
      { hex: '#D8D8D8', name_en: 'Light Gray', name_ar: 'رمادي فاتح' },
      { hex: '#C41E2E', name_en: 'Red', name_ar: 'أحمر' },
      { hex: '#2B2C79', name_en: 'Dark Blue-Purple', name_ar: 'أزرق بنفسجي داكن' },
      { hex: '#F2D400', name_en: 'Yellow', name_ar: 'أصفر' },
      { hex: '#E56A1E', name_en: 'Orange', name_ar: 'برتقالي' },
      { hex: '#A6DA8C', name_en: 'Mint Green', name_ar: 'أخضر نعناعي' },
      { hex: '#4A23A8', name_en: 'Royal Purple', name_ar: 'بنفسجي ملكي' },
      { hex: '#E03875', name_en: 'Hot Pink', name_ar: 'وردي فاقع' },
      { hex: '#77CBF7', name_en: 'Sky Blue', name_ar: 'أزرق سماوي' },
      { hex: '#C75AC9', name_en: 'Pink-Violet', name_ar: 'بنفسجي وردي' },
      { hex: '#5C2DAF', name_en: 'Indigo Purple', name_ar: 'نيلي بنفسجي' },
      { hex: '#EDEDED', name_en: 'Clear Transparent', name_ar: 'شفاف' },
      { hex: '#D43838', name_en: 'Transparent Red', name_ar: 'أحمر شفاف' },
      { hex: '#2448B5', name_en: 'Transparent Blue', name_ar: 'أزرق شفاف' },
      { hex: '#68D78B', name_en: 'Transparent Green', name_ar: 'أخضر شفاف' },
      { hex: '#4E2B8C', name_en: 'Transparent Purple', name_ar: 'بنفسجي شفاف' },
      { hex: '#4A4A4A', name_en: 'Gunmetal Gray', name_ar: 'رمادي معدني داكن' },
      { hex: '#8C3B2F', name_en: 'Transparent Brown', name_ar: 'بني شفاف' },
      { hex: '#E3E3E3', name_en: 'Frosted White', name_ar: 'أبيض متجمد' }
    ];

    const TRANSPARENT_HEXES = new Set([
      '#ededed',
      '#d43838',
      '#2448b5',
      '#68d78b',
      '#4e2b8c',
      '#8c3b2f',
      '#e3e3e3'
    ]);
    const TRANSPARENT_TINT_OPACITY = 0.55;

    const THUMB_PARTS = [
      { id: 'shell', mask: '/assets/masks/leftShell.png' },
      { id: 'trimpiece', mask: '/assets/masks/centerBody.png' },
      { id: 'faceButtons', mask: '/assets/masks/faceButtons.png' },
      { id: 'stickL', mask: '/assets/masks/stickL.png' },
      { id: 'stickR', mask: '/assets/masks/stickR.png' },
      { id: 'touchpad', mask: '/assets/masks/touchpad.png' },
      { id: 'share', mask: '/assets/masks/share.png' },
      { id: 'options', mask: '/assets/masks/options.png' },
      { id: 'psButton', mask: '/assets/masks/psButton.png' },
      { id: 'bumpers', mask: '/assets/masks/bumperL.png' }
    ];

    function getPaletteForPart(partId) {
      return SHELL_PART_IDS.has(partId) ? SHELL_COLORS : ACCESSORY_COLORS;
    }

    function randomFrom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function generateRandomBuild(index, lang) {
      const config = {};
      let total = 0;

      ALL_PARTS.forEach(part => {
        const palette = getPaletteForPart(part.id);
        const chosen = randomFrom(palette);
        config[part.id] = chosen;
        total += PRICES[part.id] || 0;
      });

      const baseName = lang === 'ar' ? 'ذزاع مخصص' : 'Custom Controller';

      return {
        id: index,
        name: baseName + ' #' + (index + 1),
        colors: config,
        total
      };
    }

    function formatMoneyBHD(v, lang) {
      const num = v.toFixed(2);
      return lang === 'ar' ? num + ' د.ب' : 'BHD ' + num;
    }

    const translations = i18n;

    let currentLang = localStorage.getItem('ez_lang') || 'ar';

    function applyLangAttributes() {
      document.documentElement.lang = currentLang;
      document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    }

    function t(key) {
      return translations[currentLang][key] || key;
    }

    function applyTranslations() {
      const dict = translations[currentLang];

      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
      });

      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (dict[key]) el.innerHTML = dict[key];
      });

      const langToggle = document.getElementById('langToggle');
      if (langToggle) langToggle.textContent = currentLang === 'ar' ? 'EN' : 'AR';
      const mobileLangToggle = document.getElementById('mobileLangToggle');
      if (mobileLangToggle) mobileLangToggle.textContent = currentLang === 'ar' ? 'EN' : 'AR';
    }

    let currentBuilds = [];

    function createBuildCard(build) {
      const dict = translations[currentLang];

      const card = document.createElement('article');
      card.className = 'build-card';

      const thumb = document.createElement('div');
      thumb.className = 'build-thumb';

      const tc = document.createElement('div');
      tc.className = 'thumb-controller';

      const base = document.createElement('div');
      base.className = 'thumb-base';
      tc.appendChild(base);

      THUMB_PARTS.forEach(p => {
        const color = build.colors[p.id];
        if (!color) return;
        const layer = document.createElement('div');
        layer.className = 'thumb-layer';
        layer.style.setProperty('--mask-url', `url('${p.mask}')`);
        layer.style.setProperty('--tint', color.hex);
        if (TRANSPARENT_HEXES.has(color.hex.toLowerCase())) {
          layer.style.setProperty('--tint-opacity', String(TRANSPARENT_TINT_OPACITY));
        } else {
          layer.style.setProperty('--tint-opacity', '1');
        }
        tc.appendChild(layer);
      });

      thumb.appendChild(tc);

      const body = document.createElement('div');
      body.className = 'build-body';

      const title = document.createElement('div');
      title.className = 'build-title';
      title.textContent = build.name;

      const price = document.createElement('div');
      price.className = 'build-price';
      price.innerHTML = formatMoneyBHD(build.total, currentLang);



      const btnRow = document.createElement('div');
      btnRow.className = 'build-btn-row';

      const previewBtn = document.createElement('button');
      previewBtn.className = 'build-cta secondary';
      previewBtn.type = 'button';
      previewBtn.textContent = i18n[currentLang].heroPremadeBtn || 'Preview';
      previewBtn.addEventListener('click', goToConfigurator);

      const addBtn = document.createElement('button');
      addBtn.className = 'build-cta';
      addBtn.type = 'button';
      addBtn.setAttribute('aria-label', i18n[currentLang].addToCart || 'Add to Cart');
      addBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
      `;
      addBtn.addEventListener('click', () => {
        const item = {
          id: Date.now(),
          name: build.name,
          colors: build.colors,
          total: build.total,
          preview: tc.outerHTML
        };
        const cart = JSON.parse(localStorage.getItem('ezCart') || '[]');
        cart.push(item);
        localStorage.setItem('ezCart', JSON.stringify(cart));
        navigate('/cart');
      });

      btnRow.appendChild(previewBtn);
      btnRow.appendChild(addBtn);
      body.appendChild(title);

      body.appendChild(price);
      body.appendChild(btnRow);



      card.appendChild(thumb);
      card.appendChild(body);

      return card;
    }

    function rebuildPremadeGrid() {
      const grid = document.getElementById('buildGrid');
      if (!grid) return;
      grid.innerHTML = '';

      if (!currentBuilds.length) {
        for (let i = 0; i < 20; i++) {
          currentBuilds.push(generateRandomBuild(i, currentLang));
        }
      } else {
        currentBuilds = currentBuilds.map((b, i) => generateRandomBuild(i, currentLang));
      }

      currentBuilds.forEach(b => grid.appendChild(createBuildCard(b)));
    }

    function setLanguage(lang) {
      currentLang = lang;
      localStorage.setItem('ez_lang', lang);
      applyLangAttributes();
      applyTranslations();
    }

    const langToggle = document.getElementById('langToggle');
    const contactForm = document.getElementById('contactForm');

    const handleLangToggle = () => {
      setLanguage(currentLang === 'ar' ? 'en' : 'ar');
    };

    const handleContactSubmit = (e) => {
      e.preventDefault();
      alert(translations[currentLang].formSuccess);
      contactForm?.reset();
    };

    const mobileLangToggle = document.getElementById('mobileLangToggle');
    langToggle?.addEventListener('click', handleLangToggle);
    mobileLangToggle?.addEventListener('click', handleLangToggle);
    contactForm?.addEventListener('submit', handleContactSubmit);

    applyLangAttributes();
    applyTranslations();
    rebuildPremadeGrid();

    return () => {
      document.body.classList.remove('home-page-active');
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
      langToggle?.removeEventListener('click', handleLangToggle);
      mobileLangToggle?.removeEventListener('click', handleLangToggle);
      contactForm?.removeEventListener('submit', handleContactSubmit);
    };
  }, [navigate]);

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', isMobileMenuOpen);
    return () => document.body.classList.remove('mobile-nav-open');
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="home-page">
      <div className={`mobile-nav-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={closeMobileMenu}></div>
      <aside className={`mobile-nav-drawer ${isMobileMenuOpen ? 'open' : ''}`} id="mobileNavDrawer" aria-hidden={!isMobileMenuOpen}>
        <button className="mobile-nav-link" type="button" data-i18n="navPremade" onClick={() => { scrollToSection('premadeSection'); closeMobileMenu(); }}></button>
        <button className="mobile-nav-link mobile-nav-cta" type="button" data-i18n="navBuildCta" onClick={() => { goToConfigurator(); closeMobileMenu(); }}></button>
        <button className="mobile-nav-link mobile-nav-lang" id="mobileLangToggle" type="button">EN</button>
      </aside>

      <section className="hero">
        <video className="hero-video" autoPlay muted loop playsInline>
          <source src="/assets/back.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay"></div>

        <div className="hero-inner">
          <div>
            <h1 className="hero-title" data-i18n-html="heroTitle"></h1>
            <p className="hero-sub" data-i18n="heroSub"></p>
            <div className="hero-actions">
              <button className="hero-btn primary" type="button" data-i18n="heroCreateBtn" onClick={goToConfigurator}></button>
              <button style={{ display: 'none' }} className="hero-btn secondary" type="button" data-i18n="heroPremadeBtn" onClick={() => scrollToSection('premadeSection')}></button>
            </div>
          </div>
        </div>
      </section>


      <section className="section" id="premadeSection" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '60px' }}>
        <div className="section-header">
          <div className="section-title" data-i18n="premadeTitle"></div>
        </div>
        <div className="build-grid" id="buildGrid"></div>
      </section>


      <section className="section" id="instagramSection" style={{ display: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '60px' }}>
        <div className="section-header">
          <div>
            <div className="section-title" data-i18n="premadeTitle"></div>
          </div>
        </div>
        <div className="instagram-grid">
          {[
            { imageUrl: "/assets/instagram/custom_ps5_controller_1_1768088488812.png", link: "https://www.instagram.com/fhonelstore/?hl=en" },
            { imageUrl: "/assets/instagram/custom_ps5_controller_2_1768088503387.png", link: "https://www.instagram.com/fhonelstore/?hl=en" },
            { imageUrl: "/assets/instagram/custom_ps5_controller_3_1768088517063.png", link: "https://www.instagram.com/fhonelstore/?hl=en" },
            { imageUrl: "/assets/instagram/custom_ps5_controller_4_1768088529110.png", link: "https://www.instagram.com/fhonelstore/?hl=en" },
            { imageUrl: "/assets/instagram/custom_ps5_controller_5_1768088542714.png", link: "https://www.instagram.com/fhonelstore/?hl=en" },
            { imageUrl: "/assets/instagram/custom_ps5_controller_6_1768088557182.png", link: "https://www.instagram.com/fhonelstore/?hl=en" },
            { imageUrl: "/assets/instagram/custom_ps5_controller_7_1768088570250.png", link: "https://www.instagram.com/fhonelstore/?hl=en" },
            { imageUrl: "/assets/instagram/custom_ps5_controller_8_1768088585868.png", link: "https://www.instagram.com/fhonelstore/?hl=en" },
            { imageUrl: "/assets/instagram/custom_ps5_controller_9_1768088602381.png", link: "https://www.instagram.com/fhonelstore/?hl=en" }
          ].map((post, i) => (
            <a
              key={i}
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="instagram-item"
            >
              <div className="instagram-overlay">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '30px', height: '30px' }}>
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </div>
              <img src={post.imageUrl} alt={`Instagram post ${i + 1}`} loading="lazy" />
            </a>
          ))}
        </div>

      </section>

      <section className="section" id="contactSection">

        <div className="section-header">
          <div className="section-title" data-i18n="contactTitle"></div>
        </div>

        <div className="contact-grid">
          <div className="contact-card">
            <h3 data-i18n="contactCardTitle"></h3>
            <p data-i18n="contactCardText"></p>

            <form id="contactForm">
              <div className="contact-form-group">
                <label className="contact-label" htmlFor="name" data-i18n="contactLabelName"></label>
                <input className="contact-input" id="name" name="name" required />
              </div>
              <div className="contact-form-group">
                <label className="contact-label" htmlFor="email" data-i18n="contactLabelEmail"></label>
                <input className="contact-input" id="email" name="email" type="email" required />
              </div>
              <div className="contact-form-group">
                <label className="contact-label" htmlFor="message" data-i18n="contactLabelMessage"></label>
                <textarea className="contact-textarea" id="message" name="message" required></textarea>
              </div>
              <button className="contact-submit" type="submit" data-i18n="contactSubmit"></button>
            </form>
          </div>

          <div className="contact-meta" data-i18n-html="contactMeta"></div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-links">
            <button onClick={() => navigate('/privacy')} className="nav-link" data-i18n="footerPrivacy"></button>
            <button onClick={() => navigate('/terms')} className="nav-link" data-i18n="footerTerms"></button>
            <button onClick={() => navigate('/returns')} className="nav-link" data-i18n="footerReturns"></button>
          </div>

          <div className="footer-copyright">
            <span data-i18n="footerText"></span>
            <span id="year"></span>
          </div>

          <div className="footer-socials">
            <a href="https://www.instagram.com/fhonelstore/?hl=en" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="social-icon">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
            <a href="mailto:Fhonelstore.2022@gmail.com" className="social-link" aria-label="Email">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="social-icon">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </a>
            <a href="https://wa.me/97333699393" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="WhatsApp">
              <svg viewBox="0 0 24 24" fill="currentColor" className="social-icon">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.035c0 2.123.554 4.197 1.607 6.04L0 24l6.117-1.605a11.81 11.81 0 005.925 1.585h.005c6.635 0 12.031-5.397 12.034-12.037a11.83 11.83 0 00-3.522-8.435z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default HomePage;
