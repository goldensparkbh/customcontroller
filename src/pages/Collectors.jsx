import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { i18n } from '../i18n.js';

const EDITIONS = [
  {
    id: 'obsidian',
    artistId: 'gold',
    image: '/assets/collectors/obsidian.png',
    number: '01',
    run: '50',
    titleEn: 'Obsidian Gold',
    titleAr: 'ذهب أوبسيديان',
    artistEn: 'Atelier Noir',
    artistAr: 'أتيليه نوار'
  },
  {
    id: 'crimson',
    artistId: 'crimson',
    image: '/assets/collectors/crimson.png',
    number: '02',
    run: '40',
    titleEn: 'Crimson Reign',
    titleAr: 'الحكم القرمزي',
    artistEn: 'Crimson Studio',
    artistAr: 'استوديو قرمزي'
  },
  {
    id: 'arctic',
    artistId: 'ice',
    image: '/assets/collectors/arctic.png',
    number: '03',
    run: '50',
    titleEn: 'Arctic Veil',
    titleAr: 'حجاب القطب',
    artistEn: 'Ice Atelier',
    artistAr: 'أتيليه الجليد'
  },
  {
    id: 'void',
    artistId: 'neon',
    image: '/assets/collectors/void.png',
    number: '04',
    run: '30',
    titleEn: 'Void Signal',
    titleAr: 'إشارة الفراغ',
    artistEn: 'Neon Pulse',
    artistAr: 'نبض نيون'
  },
  {
    id: 'solar',
    artistId: 'gold',
    image: '/assets/collectors/solar.png',
    number: '05',
    run: '40',
    titleEn: 'Solar Dust',
    titleAr: 'غبار شمسي',
    artistEn: 'Atelier Noir',
    artistAr: 'أتيليه نوار'
  },
  {
    id: 'pearl',
    artistId: 'ice',
    image: '/assets/collectors/pearl.png',
    number: '06',
    run: '25',
    titleEn: 'Pearl Cut',
    titleAr: 'قطع اللؤلؤ',
    artistEn: 'Ice Atelier',
    artistAr: 'أتيليه الجليد'
  }
];

function CollectorsPage() {
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
    <div className="collectors-page">
      <section className="collectors-hero">
        <img className="collectors-hero-media" src="/assets/collectors/hero.png" alt="" />
        <div className="collectors-hero-dim" aria-hidden="true" />
        <div className="collectors-hero-copy">
          <p className="mockup-kicker">{t('collectorsKicker')}</p>
          <h1>{t('collectorsTitle')}</h1>
          <p className="collectors-hero-sub">{t('collectorsSub')}</p>
          <div className="hero-actions">
            <a className="hero-btn primary" href="#editionGrid">{t('collectorsBrowseCta')}</a>
            <button className="hero-btn secondary" type="button" onClick={() => navigate('/artists')}>
              {t('navArtists')}
            </button>
          </div>
        </div>
      </section>

      <section className="collectors-intro">
        <p className="mockup-kicker">{t('collectorsIntroKicker')}</p>
        <h2>{t('collectorsIntroTitle')}</h2>
        <p>{t('collectorsIntroText')}</p>
      </section>

      <section className="collectors-grid-wrap" id="editionGrid">
        <div className="collectors-grid">
          {EDITIONS.map((edition) => (
            <article key={edition.id} className="collectors-edition">
              <div className="collectors-edition-visual">
                <img src={edition.image} alt={isAr ? edition.titleAr : edition.titleEn} />
                <span className="collectors-run">
                  {edition.number} / {edition.run}
                </span>
              </div>
              <div className="collectors-edition-copy">
                <p className="mockup-kicker">{isAr ? edition.artistAr : edition.artistEn}</p>
                <h3>{isAr ? edition.titleAr : edition.titleEn}</h3>
                <button className="hero-btn primary" type="button" onClick={() => navigate(`/artists/${edition.artistId}`)}>
                  {t('artistsViewDesign')}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="collectors-bottom">
        <h2>{t('collectorsBottomTitle')}</h2>
        <p>{t('collectorsBottomSub')}</p>
        <div className="hero-actions">
          <button className="hero-btn primary" type="button" onClick={() => navigate('/configurator')}>
            {t('heroCreateBtn')}
          </button>
          <button className="hero-btn secondary" type="button" onClick={() => navigate('/artists')}>
            {t('navArtists')}
          </button>
        </div>
      </section>
    </div>
  );
}

export default CollectorsPage;
