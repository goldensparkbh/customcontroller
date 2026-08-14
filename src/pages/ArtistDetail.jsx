import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getArtistById, SHOP_UPGRADES } from '../data/artists.js';
import { i18n } from '../i18n.js';
import ShopPrice from '../components/ShopPrice.jsx';
import { addShopDesignToCart } from '../utils/shopCart.js';

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6h15l-1.5 9h-12L6 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 6 5 3H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="20" r="1.4" fill="currentColor" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" />
    </svg>
  );
}

function BadgeIcon({ type }) {
  if (type === 'quality') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3 5 6.5v5.2c0 4.2 2.8 7.9 7 9.3 4.2-1.4 7-5.1 7-9.3V6.5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === 'paint') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20c2-1 3-3 3-5 0-2 2-4 5-4 4 0 7 3 7 7 0 1-.2 2-.6 3H4Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14 4c1.2 1.4 2 3.2 2 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 5v2.2M12 16.8V19M5 12h2.2M16.8 12H19M7.2 7.2l1.6 1.6M15.2 15.2l1.6 1.6M16.8 7.2l-1.6 1.6M8.8 15.2l-1.6 1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArtistDetailPage() {
  const { artistId } = useParams();
  const navigate = useNavigate();
  const design = getArtistById(artistId);
  const [lang, setLang] = useState(() => localStorage.getItem('ez_lang') || 'ar');
  const [activeShot, setActiveShot] = useState(0);
  const [selectedUpgrades, setSelectedUpgrades] = useState([]);
  const isAr = lang === 'ar';
  const t = (key) => (i18n[lang] && i18n[lang][key]) || (i18n.en && i18n.en[key]) || key;

  useEffect(() => {
    const onLang = () => setLang(localStorage.getItem('ez_lang') || 'ar');
    window.addEventListener('ez-lang-change', onLang);
    return () => window.removeEventListener('ez-lang-change', onLang);
  }, []);

  useEffect(() => {
    setActiveShot(0);
    setSelectedUpgrades([]);
    window.scrollTo(0, 0);
    document.body.classList.add('home-page-active', 'shop-page-active');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    return () => {
      document.body.classList.remove('home-page-active', 'shop-page-active');
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, [artistId]);

  if (!design) return <Navigate to="/artists" replace />;

  const gallery = design.gallery?.length ? design.gallery : [design.image];
  const mainImage = gallery[activeShot] || design.image;
  const upgradeTotal = SHOP_UPGRADES
    .filter((item) => selectedUpgrades.includes(item.id))
    .reduce((sum, item) => sum + item.price, 0);
  const total = design.price + upgradeTotal;

  const shiftThumb = (delta) => {
    setActiveShot((current) => (current + delta + gallery.length) % gallery.length);
  };

  const toggleUpgrade = (id) => {
    setSelectedUpgrades((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const addToCart = () => {
    const upgrades = SHOP_UPGRADES.filter((item) => selectedUpgrades.includes(item.id));
    addShopDesignToCart(design, { upgrades, image: mainImage, lang });
    navigate('/cart');
  };

  return (
    <div className="shop-page shop-detail-page">
      <nav className="shop-crumbs" aria-label="Breadcrumb">
        <Link to="/">{t('navHome')}</Link>
        <span>/</span>
        <Link to="/artists">{t('shopAllDesigns')}</Link>
        <span>/</span>
        <Link to="/artists">{isAr ? design.categoryAr : design.categoryEn}</Link>
        <span>/</span>
        <em>{isAr ? design.nameAr : design.nameEn}</em>
      </nav>

      <div className="shop-detail">
        <div className="shop-gallery">
          <div className="shop-gallery-main">
            <img src={mainImage} alt={isAr ? design.nameAr : design.nameEn} />
          </div>
          <div className="shop-thumbs">
            <button type="button" className="shop-thumb-nav" onClick={() => shiftThumb(-1)} aria-label={t('artistsPrev')}>
              ‹
            </button>
            {gallery.map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                className={`shop-thumb${index === activeShot ? ' is-active' : ''}`}
                onClick={() => setActiveShot(index)}
                aria-label={`${t('artistsGalleryShot')} ${index + 1}`}
              >
                <img src={src} alt="" />
              </button>
            ))}
            <button type="button" className="shop-thumb-nav" onClick={() => shiftThumb(1)} aria-label={t('artistsNext')}>
              ›
            </button>
          </div>
        </div>

        <div className="shop-info">
          <p className="shop-card-cat">{isAr ? design.categoryAr : design.categoryEn}</p>
          <h1>{isAr ? design.nameAr : design.nameEn}</h1>
          <p className="shop-artist">{t('shopArtBy')} {isAr ? design.artistAr : design.artistEn}</p>
          <p className="shop-info-copy">{isAr ? design.bioAr : design.bioEn}</p>
          <p className="shop-info-copy">{isAr ? design.storyAr : design.storyEn}</p>
          <ShopPrice amountBhd={total} className="shop-detail-price" />

          <div className="shop-upgrades">
            <h2>{t('shopUpgrades')}</h2>
            <ul>
              {SHOP_UPGRADES.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      className="shop-check"
                      checked={selectedUpgrades.includes(item.id)}
                      onChange={() => toggleUpgrade(item.id)}
                    />
                    <span>{isAr ? item.nameAr : item.nameEn}</span>
                  </label>
                  <ShopPrice amountBhd={item.price} className="shop-upgrade-price" split={false} />
                </li>
              ))}
            </ul>
          </div>

          <button type="button" className="shop-add-btn" onClick={addToCart}>
            <CartIcon />
            {t('addToCart')}
          </button>

          <div className="shop-trust">
            <div>
              <span className="shop-trust-icon"><BadgeIcon type="quality" /></span>
              <strong>{t('shopTrustQuality')}</strong>
              <span>{t('shopFeatQualitySub')}</span>
            </div>
            <div>
              <span className="shop-trust-icon"><BadgeIcon type="paint" /></span>
              <strong>{t('shopTrustPaint')}</strong>
              <span>{t('shopFeatPaintSub')}</span>
            </div>
            <div>
              <span className="shop-trust-icon"><BadgeIcon type="one" /></span>
              <strong>{t('shopTrustOne')}</strong>
              <span>{t('shopFeatOneSub')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArtistDetailPage;
