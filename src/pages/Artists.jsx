import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ARTISTS } from '../data/artists.js';
import { i18n } from '../i18n.js';

function ArtistsPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(() => localStorage.getItem('ez_lang') || 'ar');
  const isAr = lang === 'ar';
  const t = (key) => (i18n[lang] && i18n[lang][key]) || (i18n.en && i18n.en[key]) || key;

  useEffect(() => {
    const onLang = () => setLang(localStorage.getItem('ez_lang') || 'ar');
    window.addEventListener('ez-lang-change', onLang);
    return () => window.removeEventListener('ez-lang-change', onLang);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.classList.add('home-page-active');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    return () => {
      document.body.classList.remove('home-page-active');
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, []);

  return (
    <div className="artists-page">
      <section className="artists-hero">
        <video className="artists-hero-video" autoPlay muted loop playsInline>
          <source src="/assets/back.mp4" type="video/mp4" />
        </video>
        <div className="artists-hero-dim" aria-hidden="true" />
        <img className="artists-hero-media" src="/assets/artists/hero.png" alt="" />
        <div className="artists-hero-copy">
          <p className="mockup-kicker">{t('artistsKicker')}</p>
          <h1>{t('artistsTitle')}</h1>
          <p className="artists-hero-sub">{t('artistsSub')}</p>
          <div className="hero-actions">
            <a className="hero-btn primary" href="#artistGrid">{t('artistsMeetCta')}</a>
            <button className="hero-btn secondary" type="button" onClick={() => navigate('/collectors')}>
              {t('navCollectors')}
            </button>
          </div>
        </div>
      </section>

      <section className="artists-index" id="artistGrid">
        <div className="artists-index-header">
          <p className="mockup-kicker">{t('artistsIndexKicker')}</p>
          <h2>{t('artistsIndexTitle')}</h2>
          <p>{t('artistsIndexText')}</p>
        </div>
        <div className="artists-index-grid">
          {ARTISTS.map((artist, index) => (
            <button
              key={artist.id}
              type="button"
              className="artists-index-card"
              onClick={() => navigate(`/artists/${artist.id}`)}
            >
              <img src={artist.image} alt={isAr ? artist.designAr : artist.designEn} />
              <span className="mockup-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="artists-index-card-copy">
                <p className="mockup-kicker">{isAr ? artist.nameAr : artist.nameEn}</p>
                <h3>{isAr ? artist.designAr : artist.designEn}</h3>
                <span className="artists-index-link">{t('artistsViewDesign')}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ArtistsPage;
