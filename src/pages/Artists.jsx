import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ARTISTS, SHOP_CATEGORIES } from '../data/artists.js';
import { i18n } from '../i18n.js';
import ShopPrice from '../components/ShopPrice.jsx';
import { addShopDesignToCart } from '../utils/shopCart.js';
import { fetchArtistCatalog, fetchArtistCategories } from '../services/backendApi.js';
import { withAllCategory } from '../lib/artistProducts.js';
import LoadingState from '../components/LoadingState.jsx';

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

function FeatureIcon({ type }) {
  if (type === 'paint') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20c2-1 3-3 3-5 0-2 2-4 5-4 4 0 7 3 7 7 0 1-.2 2-.6 3H4Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14 4c1.2 1.4 2 3.2 2 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'one') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 5v2.1M12 16.9V19M5 12h2.1M16.9 12H19M7.1 7.1l1.5 1.5M15.4 15.4l1.5 1.5M16.9 7.1l-1.5 1.5M8.6 15.4 7.1 16.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 5 6.5v5.2c0 4.2 2.8 7.9 7 9.3 4.2-1.4 7-5.1 7-9.3V6.5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function ArtistsPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(() => localStorage.getItem('ez_lang') || 'ar');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [catalog, setCatalog] = useState(null);
  const [shopCategories, setShopCategories] = useState(SHOP_CATEGORIES);
  const isAr = lang === 'ar';
  const t = (key) => (i18n[lang] && i18n[lang][key]) || (i18n.en && i18n.en[key]) || key;

  useEffect(() => {
    const onLang = () => setLang(localStorage.getItem('ez_lang') || 'ar');
    window.addEventListener('ez-lang-change', onLang);
    return () => window.removeEventListener('ez-lang-change', onLang);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchArtistCatalog(), fetchArtistCategories()])
      .then(([products, categories]) => {
        if (!alive) return;
        setCatalog(Array.isArray(products) ? products : []);
        setShopCategories(
          Array.isArray(categories) && categories.length
            ? withAllCategory(categories)
            : SHOP_CATEGORIES
        );
      })
      .catch(() => {
        if (!alive) return;
        setCatalog([]);
        setShopCategories(SHOP_CATEGORIES);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.classList.add('home-page-active', 'shop-page-active');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    return () => {
      document.body.classList.remove('home-page-active', 'shop-page-active');
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, []);

  const source = catalog && catalog.length ? catalog : ARTISTS;

  useEffect(() => {
    if (!shopCategories.some((item) => item.id === category)) {
      setCategory('all');
    }
  }, [shopCategories, category]);
  const designs = useMemo(() => {
    const list = category === 'all' ? source.slice() : source.filter((item) => item.category === category);
    if (sort === 'price-high') return list.sort((a, b) => b.price - a.price);
    if (sort === 'price-low') return list.sort((a, b) => a.price - b.price);
    return list;
  }, [category, sort, source]);

  const addDesign = (event, design) => {
    event.stopPropagation();
    if (design.quantity != null && Number(design.quantity) <= 0) return;
    addShopDesignToCart(design, { lang });
  };

  if (catalog === null) {
    return <LoadingState message={t('loadingConfigurator')} fullScreen={false} />;
  }

  return (
    <div className="shop-page">
      <section className="shop-hero">
        <div className="shop-hero-copy">
          <p className="shop-kicker">{t('shopHeroKicker')}</p>
          <h1>
            {t('shopHeroTitle')} <span>{t('shopHeroTitleAccent')}</span>
          </h1>
          <p className="shop-hero-sub">{t('shopHeroSub')}</p>
          <div className="shop-hero-features">
            <div>
              <FeatureIcon type="paint" />
              <div>
                <strong>{t('shopFeatPaintTitle')}</strong>
                <span>{t('shopFeatPaintSub')}</span>
              </div>
            </div>
            <div>
              <FeatureIcon type="one" />
              <div>
                <strong>{t('shopFeatOneTitle')}</strong>
                <span>{t('shopFeatOneSub')}</span>
              </div>
            </div>
            <div>
              <FeatureIcon type="quality" />
              <div>
                <strong>{t('shopFeatQualityTitle')}</strong>
                <span>{t('shopFeatQualitySub')}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="shop-hero-visual">
          <img src="/assets/shop/shop-hero-lava.png" alt="" />
        </div>
      </section>

      <section className="shop-toolbar">
        <div className="shop-filters" role="tablist">
          {shopCategories.map((item) => {
            const count = item.id === 'all' ? source.length : source.filter((design) => design.category === item.id).length;
            const label = isAr ? item.ar : item.en;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={category === item.id}
                className={category === item.id ? 'is-active' : ''}
                onClick={() => setCategory(item.id)}
              >
                {item.id === 'all' ? `${label} (${count})` : label}
              </button>
            );
          })}
        </div>
        <label className="shop-sort">
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={t('shopSortLabel')}>
            <option value="newest">{t('shopSortNewest')}</option>
            <option value="price-high">{t('shopSortPriceHigh')}</option>
            <option value="price-low">{t('shopSortPriceLow')}</option>
          </select>
        </label>
      </section>

      <section className="shop-grid-wrap">
        <div className="shop-grid">
          {designs.length === 0 && (
            <p className="shop-empty">{t('shopEmptyCategory')}</p>
          )}
          {designs.map((design) => (
            <article
              key={design.id}
              className="shop-card"
              onClick={() => navigate(`/artists/${design.id}`)}
              role="link"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/artists/${design.id}`);
                }
              }}
            >
              <div className="shop-card-media">
                <img src={design.image} alt={isAr ? design.nameAr : design.nameEn} />
              </div>
              <div className="shop-card-body">
                <p className="shop-card-cat">{isAr ? design.categoryAr : design.categoryEn}</p>
                <div className="shop-card-row">
                  <h3>{isAr ? design.nameAr : design.nameEn}</h3>
                  <ShopPrice amountBhd={design.price} className="shop-card-price" />
                </div>
                <p className="shop-card-desc">{isAr ? design.cardAr : design.cardEn}</p>
                <button
                  type="button"
                  className="shop-card-cart"
                  aria-label={t('addToCart')}
                  disabled={design.quantity != null && Number(design.quantity) <= 0}
                  onClick={(event) => addDesign(event, design)}
                >
                  <CartIcon />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ArtistsPage;
