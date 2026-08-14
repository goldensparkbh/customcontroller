import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getAdjacentArtists, getArtistById } from '../data/artists.js';
import { i18n } from '../i18n.js';

function ArtistDetailPage() {
  const { artistId } = useParams();
  const navigate = useNavigate();
  const artist = getArtistById(artistId);
  const { prev, next } = getAdjacentArtists(artistId);
  const [lang, setLang] = useState(() => localStorage.getItem('ez_lang') || 'ar');
  const [activeShot, setActiveShot] = useState(0);
  const isAr = lang === 'ar';
  const t = (key) => (i18n[lang] && i18n[lang][key]) || (i18n.en && i18n.en[key]) || key;

  useEffect(() => {
    const onLang = () => setLang(localStorage.getItem('ez_lang') || 'ar');
    window.addEventListener('ez-lang-change', onLang);
    return () => window.removeEventListener('ez-lang-change', onLang);
  }, []);

  useEffect(() => {
    setActiveShot(0);
    window.scrollTo(0, 0);
    document.body.classList.add('home-page-active');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    return () => {
      document.body.classList.remove('home-page-active');
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, [artistId]);

  if (!artist) return <Navigate to="/artists" replace />;

  const gallery = artist.gallery || [artist.image];
  const mainImage = gallery[activeShot] || artist.image;

  return (
    <div className="artist-detail-page">
      <section className="artist-detail-hero">
        <img className="artist-detail-hero-media" src={mainImage} alt={isAr ? artist.designAr : artist.designEn} />
        <div className="artist-detail-hero-dim" aria-hidden="true" />
        <div className="artist-detail-hero-copy">
          <button className="artist-detail-back" type="button" onClick={() => navigate('/artists')}>
            {t('artistsBack')}
          </button>
          <p className="mockup-kicker">{isAr ? artist.nameAr : artist.nameEn}</p>
          <h1>{isAr ? artist.designAr : artist.designEn}</h1>
          <p className="artist-detail-lead">{isAr ? artist.bioAr : artist.bioEn}</p>
          <div className="hero-actions">
            <button className="hero-btn primary" type="button" onClick={() => navigate('/configurator')}>
              {t('artistsBuildDesign')}
            </button>
            <button className="hero-btn secondary" type="button" onClick={() => navigate('/collectors')}>
              {t('navCollectors')}
            </button>
          </div>
        </div>
      </section>

      <section className="artist-detail-specs">
        <div>
          <span>{t('artistsSpecFinish')}</span>
          <strong>{isAr ? artist.finishAr : artist.finishEn}</strong>
        </div>
        <div>
          <span>{t('artistsSpecShell')}</span>
          <strong>{isAr ? artist.shellAr : artist.shellEn}</strong>
        </div>
        <div>
          <span>{t('artistsSpecRun')}</span>
          <strong>{artist.run}</strong>
        </div>
        <div>
          <span>{t('artistsSpecYear')}</span>
          <strong>{artist.year}</strong>
        </div>
      </section>

      <section className="artist-detail-gallery">
        <div className="artist-detail-gallery-main">
          <img src={mainImage} alt="" />
        </div>
        <div className="artist-detail-thumbs">
          {gallery.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              className={`artist-detail-thumb${index === activeShot ? ' is-active' : ''}`}
              onClick={() => setActiveShot(index)}
              aria-label={`${t('artistsGalleryShot')} ${index + 1}`}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      </section>

      <section className="artist-detail-story">
        <div>
          <p className="mockup-kicker">{t('artistsDesignKicker')}</p>
          <h2>{isAr ? artist.designAr : artist.designEn}</h2>
          <p>{isAr ? artist.storyAr : artist.storyEn}</p>
        </div>
        <aside>
          <p className="mockup-kicker">{t('artistsStudioKicker')}</p>
          <h3>{isAr ? artist.nameAr : artist.nameEn}</h3>
          <p>{isAr ? artist.roleAr : artist.roleEn}</p>
        </aside>
      </section>

      <section className="artist-detail-pager">
        <button type="button" onClick={() => navigate(`/artists/${prev.id}`)}>
          <span className="mockup-kicker">{t('artistsPrev')}</span>
          <strong>{isAr ? prev.designAr : prev.designEn}</strong>
        </button>
        <button type="button" onClick={() => navigate(`/artists/${next.id}`)}>
          <span className="mockup-kicker">{t('artistsNext')}</span>
          <strong>{isAr ? next.designAr : next.designEn}</strong>
        </button>
      </section>
    </div>
  );
}

export default ArtistDetailPage;
