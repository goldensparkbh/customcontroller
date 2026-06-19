import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { i18n } from '../i18n.js';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { fetchHomeBanners } from '../services/backendApi.js';
import { getBannerDurationMs, getDefaultHomeBanners } from '../lib/homeBanners.js';

const JOURNEY_STEPS = [
  { num: '01', titleKey: 'homeStep1Title', descKey: 'homeStep1Desc', image: '/assets/home-step-customize.png' },
  { num: '02', titleKey: 'homeStep2Title', descKey: 'homeStep2Desc', image: '/assets/home-step-pay.png' },
  { num: '03', titleKey: 'homeStep3Title', descKey: 'homeStep3Desc', image: '/assets/home-step-deliver.png' },
];

const FEATURES = [
  { titleKey: 'homeFeature1Title', descKey: 'homeFeature1Desc', icon: 'preview' },
  { titleKey: 'homeFeature2Title', descKey: 'homeFeature2Desc', icon: 'designs' },
  { titleKey: 'homeFeature3Title', descKey: 'homeFeature3Desc', icon: 'parts' },
  { titleKey: 'homeFeature4Title', descKey: 'homeFeature4Desc', icon: 'delivery' },
];

function FeatureIcon({ type }) {
  const props = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (type === 'preview') {
    return (
      <svg {...props}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (type === 'designs') {
    return (
      <svg {...props}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }
  if (type === 'parts') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const { formatFromBhd } = useCurrency();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('ez_lang') || 'ar');
  const [trackIndex, setTrackIndex] = useState(0);
  const [bannerTransition, setBannerTransition] = useState(true);
  const [isBannerPaused, setIsBannerPaused] = useState(false);
  const [isRtl, setIsRtl] = useState(() => (localStorage.getItem('ez_lang') || 'ar') === 'ar');
  const [bannerSlides, setBannerSlides] = useState(() => getDefaultHomeBanners(localStorage.getItem('ez_lang') || 'ar'));
  const parallaxRef = useRef(null);
  const trackRef = useRef(null);

  const loopSlides = useMemo(() => {
    if (bannerSlides.length <= 1) return bannerSlides;
    return [...bannerSlides, bannerSlides[0]];
  }, [bannerSlides]);

  const activeBannerIndex = bannerSlides.length
    ? trackIndex % bannerSlides.length
    : 0;

  const goToConfigurator = () => {
    navigate('/configurator');
  };

  useEffect(() => {
    const onLang = () => {
      const next = localStorage.getItem('ez_lang') || 'ar';
      setLang(next);
      setIsRtl(next === 'ar');
      setTrackIndex(0);
      setBannerTransition(true);
    };
    window.addEventListener('ez-lang-change', onLang);
    return () => window.removeEventListener('ez-lang-change', onLang);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchHomeBanners();
        if (!alive) return;
        const locale = lang === 'ar' ? 'ar' : 'en';
        const remote = Array.isArray(data[locale]) ? data[locale] : [];
        setBannerSlides(remote.length ? remote : getDefaultHomeBanners(locale));
        setTrackIndex(0);
        setBannerTransition(true);
      } catch {
        if (!alive) return;
        setBannerSlides(getDefaultHomeBanners(lang === 'ar' ? 'ar' : 'en'));
        setTrackIndex(0);
        setBannerTransition(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lang]);

  useEffect(() => {
    const heroNote = document.querySelector('[data-hero-price-bhd]');
    if (!heroNote) return;
    const fromPrice = formatFromBhd(4);
    heroNote.innerHTML =
      lang === 'ar'
        ? `الأسعار تبدأ من <strong>${fromPrice}</strong>. بدون اشتراك — منتجات مخصصة بالكامل.`
        : `Prices start from <strong>${fromPrice}</strong>. No subscription — just fully custom gear.`;
  }, [formatFromBhd, lang]);

  useEffect(() => {
    if (isBannerPaused || bannerSlides.length <= 1) return undefined;
    if (trackIndex >= bannerSlides.length) return undefined;

    const currentSlide = bannerSlides[trackIndex];
    const duration = getBannerDurationMs(currentSlide);
    const timer = window.setTimeout(() => {
      setTrackIndex((prev) => prev + 1);
    }, duration);

    return () => window.clearTimeout(timer);
  }, [isBannerPaused, bannerSlides, trackIndex]);

  const handleTrackTransitionEnd = useCallback((e) => {
    if (e.target !== trackRef.current) return;
    if (e.propertyName !== 'transform') return;
    if (bannerSlides.length <= 1) return;
    if (trackIndex !== bannerSlides.length) return;

    setBannerTransition(false);
    setTrackIndex(0);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setBannerTransition(true);
      });
    });
  }, [bannerSlides.length, trackIndex]);

  useEffect(() => {
    const root = parallaxRef.current;
    if (!root) return undefined;

    const layers = root.querySelectorAll('[data-parallax-speed]');
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const rect = root.getBoundingClientRect();
        const viewH = window.innerHeight;
        if (rect.bottom < 0 || rect.top > viewH) return;

        const progress = (viewH - rect.top) / (viewH + rect.height);
        layers.forEach((el) => {
          const speed = parseFloat(el.getAttribute('data-parallax-speed') || '0.2');
          const offset = (progress - 0.5) * speed * 120;
          el.style.transform = `translate3d(0, ${offset}px, 0)`;
        });
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const reveals = document.querySelectorAll('.home-reveal');
    if (!reveals.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    reveals.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.add('home-page-active');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear().toString();

    const translations = i18n;

    let currentLang = localStorage.getItem('ez_lang') || 'ar';

    function applyLangAttributes() {
      document.documentElement.lang = currentLang;
      document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
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

    return () => {
      document.body.classList.remove('home-page-active');
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
      langToggle?.removeEventListener('click', handleLangToggle);
      mobileLangToggle?.removeEventListener('click', handleLangToggle);
      contactForm?.removeEventListener('submit', handleContactSubmit);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', isMobileMenuOpen);
    return () => document.body.classList.remove('mobile-nav-open');
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const goToBanner = useCallback((targetIndex) => {
    if (bannerSlides.length <= 1) return;

    const atClone = trackIndex === bannerSlides.length;
    if (atClone) {
      setBannerTransition(false);
      setTrackIndex(0);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setBannerTransition(true);
          if (targetIndex !== 0) setTrackIndex(targetIndex);
        });
      });
      return;
    }

    setTrackIndex(targetIndex);
  }, [bannerSlides.length, trackIndex]);

  const renderBannerSlide = (slide) => {
    const hasImage = Boolean(slide.imageUrl);
    const content = (
      <>
        <div className="home-banner-glow" aria-hidden="true" />
        {hasImage ? <div className="home-banner-image-overlay" aria-hidden="true" /> : null}
        {slide.eyebrow ? <p className="home-banner-eyebrow">{slide.eyebrow}</p> : null}
        {slide.title ? <h2 className="home-banner-title">{slide.title}</h2> : null}
        {slide.subtitle ? <p className="home-banner-sub">{slide.subtitle}</p> : null}
        {slide.linkUrl ? (
          <span className="home-banner-link-preview">{slide.linkLabel || slide.linkUrl}</span>
        ) : null}
      </>
    );

    const className = `home-banner-slide home-banner-slide--${slide.accent || 'cyan'}${hasImage ? ' home-banner-slide--has-image' : ''}`;
    const style = hasImage ? { backgroundImage: `url("${slide.imageUrl}")` } : undefined;

    if (slide.linkUrl) {
      const isExternal = /^https?:\/\//i.test(slide.linkUrl);
      if (isExternal) {
        return (
          <a
            href={slide.linkUrl}
            className={className}
            style={style}
            target={slide.linkNewTab ? '_blank' : undefined}
            rel={slide.linkNewTab ? 'noopener noreferrer' : undefined}
          >
            {content}
          </a>
        );
      }
      return (
        <button type="button" className={`${className} home-banner-slide--link`} style={style} onClick={() => navigate(slide.linkUrl)}>
          {content}
        </button>
      );
    }

    return (
      <article className={className} style={style}>
        {content}
      </article>
    );
  };

  return (
    <div className="home-page">
      <div className={`mobile-nav-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={closeMobileMenu}></div>
      <aside className={`mobile-nav-drawer ${isMobileMenuOpen ? 'open' : ''}`} id="mobileNavDrawer" aria-hidden={!isMobileMenuOpen}>
        <button className="mobile-nav-link mobile-nav-cta" type="button" data-i18n="navBuildCta" onClick={() => { goToConfigurator(); closeMobileMenu(); }}></button>
        <button className="mobile-nav-link mobile-nav-lang" id="mobileLangToggle" type="button">EN</button>
      </aside>

      <section className="hero">
        <video className="hero-video" autoPlay muted loop playsInline>
          <source src="/assets/back.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay"></div>

        <div
          className="home-banner"
          onMouseEnter={() => setIsBannerPaused(true)}
          onMouseLeave={() => setIsBannerPaused(false)}
          onFocus={() => setIsBannerPaused(true)}
          onBlur={() => setIsBannerPaused(false)}
        >
          {bannerSlides.length > 0 ? (
            <>
              <div className="home-banner-viewport">
                <div
                  ref={trackRef}
                  className={`home-banner-track${bannerTransition ? '' : ' home-banner-track--instant'}`}
                  onTransitionEnd={handleTrackTransitionEnd}
                  style={{
                    transform: isRtl
                      ? `translateX(calc(${trackIndex} * 100%))`
                      : `translateX(calc(-${trackIndex} * 100%))`,
                  }}
                >
                  {loopSlides.map((slide, i) => (
                    <React.Fragment key={i === bannerSlides.length ? `${slide.id}-clone` : slide.id}>
                      {renderBannerSlide(slide)}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              {bannerSlides.length > 1 ? (
                <div className="home-banner-dots" role="tablist" aria-label="Promotional banners">
                  {bannerSlides.map((slide, i) => (
                    <button
                      key={slide.id}
                      type="button"
                      role="tab"
                      aria-selected={activeBannerIndex === i}
                      aria-label={`Banner ${i + 1}`}
                      className={`home-banner-dot${activeBannerIndex === i ? ' is-active' : ''}`}
                      onClick={() => goToBanner(i)}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="hero-inner">
          <div>
            <h1 className="hero-title" data-i18n-html="heroTitle"></h1>
            <p className="hero-sub" data-i18n="heroSub"></p>
            <p className="hero-note" data-hero-price-bhd style={{ marginTop: '0.75rem', opacity: 0.9 }} />
            <div className="hero-actions">
              <button className="hero-btn primary" type="button" data-i18n="heroCreateBtn" onClick={goToConfigurator}></button>
            </div>
          </div>
        </div>
      </section>

      <section className="home-showcase" ref={parallaxRef}>
        <div className="home-showcase-inner home-reveal">
          <div className="home-showcase-copy">
            <p className="home-eyebrow" data-i18n="homeShowcaseEyebrow" />
            <h2 className="home-section-title" data-i18n="homeShowcaseTitle" />
            <p className="home-section-sub" data-i18n="homeShowcaseSub" />
            <button className="hero-btn primary home-showcase-cta" type="button" data-i18n="heroCreateBtn" onClick={goToConfigurator} />
          </div>
          <div className="home-showcase-visual">
            <div className="home-showcase-orb home-showcase-orb--1" data-parallax-speed="0.35" aria-hidden="true" />
            <div className="home-showcase-orb home-showcase-orb--2" data-parallax-speed="0.55" aria-hidden="true" />
            <div className="home-showcase-controller" data-parallax-speed="0.15">
              <img src="/assets/controller.png" alt="" loading="lazy" draggable="false" />
            </div>
            <div className="home-showcase-ring" data-parallax-speed="0.4" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="home-journey">
        <div className="home-journey-header home-reveal">
          <p className="home-eyebrow" data-i18n="homeJourneyEyebrow" />
          <h2 className="home-section-title" data-i18n="homeJourneyTitle" />
          <p className="home-section-sub" data-i18n="homeJourneySub" />
        </div>
        <div className="home-journey-steps">
          {JOURNEY_STEPS.map((step, i) => (
            <article key={step.num} className={`home-journey-step home-reveal home-reveal--delay-${i + 1}`}>
              <div className="home-journey-step-visual">
                <img src={step.image} alt="" loading="lazy" draggable="false" />
                <span className="home-journey-step-num">{step.num}</span>
              </div>
              <div className="home-journey-step-copy">
                <h3 data-i18n={step.titleKey} />
                <p data-i18n={step.descKey} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-features">
        <div className="home-features-grid">
          {FEATURES.map((feat, i) => (
            <article key={feat.titleKey} className={`home-feature-card home-reveal home-reveal--delay-${i + 1}`}>
              <div className="home-feature-icon">
                <FeatureIcon type={feat.icon} />
              </div>
              <h3 data-i18n={feat.titleKey} />
              <p data-i18n={feat.descKey} />
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta home-reveal">
        <div className="home-cta-glow" aria-hidden="true" />
        <h2 className="home-cta-title" data-i18n="homeCtaTitle" />
        <p className="home-cta-sub" data-i18n="homeCtaSub" />
        <button className="hero-btn primary" type="button" data-i18n="homeCtaBtn" onClick={goToConfigurator} />
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
