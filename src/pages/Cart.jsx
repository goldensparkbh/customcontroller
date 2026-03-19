import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { i18n } from '../i18n.js';
import ItemCustomizationSummary from '../components/ItemCustomizationSummary.jsx';

const PreviewStack = ({ layers, fallbackSrc, alt }) => (
  <div style={{ position: 'relative', aspectRatio: '1.5', background: '#11141b', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
    {Array.isArray(layers) && layers.length > 0 ? (
      layers.map((layer, idx) => (
        <img
          key={`${layer.src || 'layer'}-${idx}`}
          src={layer.src}
          alt={idx === 0 ? alt : ''}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: layer.opacity == null ? 1 : layer.opacity,
            zIndex: layer.zIndex == null ? idx : layer.zIndex,
            pointerEvents: 'none'
          }}
        />
      ))
    ) : (
      <img src={fallbackSrc || "/assets/controller.png"} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    )}
  </div>
);

const collectPreviewUrls = (item) => {
  const urls = [];
  if (item.preview) return urls;

  if (Array.isArray(item.previewFrontLayers) && item.previewFrontLayers.length > 0) {
    item.previewFrontLayers.forEach((layer) => {
      if (layer && layer.src) urls.push(layer.src);
    });
  } else if (item.previewFront) {
    urls.push(item.previewFront);
  }

  if (Array.isArray(item.previewBackLayers) && item.previewBackLayers.length > 0) {
    item.previewBackLayers.forEach((layer) => {
      if (layer && layer.src) urls.push(layer.src);
    });
  } else if (item.previewBack) {
    urls.push(item.previewBack);
  }

  return urls;
};

const CartPage = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState('ar');
  const [cartItems, setCartItems] = useState([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const previewSignatureRef = useRef('');

  useEffect(() => {
    document.body.classList.add('cart-page-active');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';

    const loadCart = () => {
      try {
        const raw = localStorage.getItem("ezCart");
        if (raw) {
          setCartItems(JSON.parse(raw));
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadCart();

    return () => {
      document.body.classList.remove('cart-page-active');
      document.documentElement.style.overflowY = '';
      document.body.style.overflowY = '';
    };
  }, []);

  useEffect(() => {
    const previewUrls = Array.from(new Set(cartItems.flatMap(collectPreviewUrls).filter(Boolean)));
    const signature = previewUrls.join('|');

    if (!previewUrls.length) {
      previewSignatureRef.current = '';
      setIsPreviewLoading(false);
      return;
    }

    if (signature === previewSignatureRef.current) {
      setIsPreviewLoading(false);
      return;
    }

    previewSignatureRef.current = signature;
    setIsPreviewLoading(true);

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) setIsPreviewLoading(false);
    }, 6000);

    const loadImage = (src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });

    Promise.allSettled(previewUrls.map(loadImage)).then(() => {
      if (cancelled) return;
      window.clearTimeout(timeoutId);
      setIsPreviewLoading(false);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [cartItems]);

  const t = (key) => (i18n[lang] && i18n[lang][key]) ? i18n[lang][key] : key;

  const handleRemove = (index) => {
    const newCart = [...cartItems];
    newCart.splice(index, 1);
    setCartItems(newCart);
    localStorage.setItem("ezCart", JSON.stringify(newCart));
  };

  const handleQuantityChange = (index, delta) => {
    const newCart = [...cartItems];
    let qty = newCart[index].quantity || 1;
    qty += delta;
    if (qty < 1) qty = 1;
    newCart[index].quantity = qty;
    setCartItems(newCart);
    localStorage.setItem("ezCart", JSON.stringify(newCart));
  };

  const totals = cartItems.reduce((acc, item) => {
    const qty = item.quantity || 1;
    acc.count += qty;
    acc.sum += (item.unitPrice || item.total || 0) * qty;
    return acc;
  }, { count: 0, sum: 0 });

  return (
    <div className="cart-page" style={{ background: '#0b0b0f', minHeight: '100vh', color: '#fff', paddingBottom: '2rem' }}>
      {isPreviewLoading && (
        <div className="zoho-loading-overlay" aria-live="polite" aria-hidden="false">
          <div className="zoho-loading-card">
            <div className="zoho-loading-spinner" aria-hidden="true"></div>
            <div className="zoho-loading-text">{t('loadingCartPreviews') || 'Loading your customized controllers...'}</div>
          </div>
        </div>
      )}
      {/* Removed Top Nav */}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Left: Cart Items */}
        <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ margin: '0 0 1rem 0' }}>{t('cartTitle') || 'Your Cart'}</h2>

          {cartItems.length === 0 && (
            <div style={{ background: '#1c1f28', padding: '2rem', borderRadius: '8px', textAlign: 'center', color: '#aaa' }}>
              {t('cartEmpty') || 'Your cart is empty.'}
            </div>
          )}

          {cartItems.map((item, idx) => (
            <div key={item.id || idx} style={{ background: '#1c1f28', padding: '1.5rem', borderRadius: '8px', display: 'flex', gap: '2rem', position: 'relative' }}>

              {/* Image Preview Container (Showing snapshots or HTML-based premade view) */}
              <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {item.preview ? (
                  /* Premade item from Home page */
                  <div 
                    className="premade-cart-preview"
                    style={{ position: 'relative', aspectRatio: '1.5', background: '#11141b', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}
                    dangerouslySetInnerHTML={{ __html: item.preview }}
                  />
                ) : (
                  /* Custom item from Configurator */
                  <>
                    <PreviewStack layers={item.previewFrontLayers} fallbackSrc={item.previewFront || "/assets/controller.png"} alt="Front" />
                    {(item.previewBackLayers?.length > 0 || item.previewBack) && (
                      <PreviewStack layers={item.previewBackLayers} fallbackSrc={item.previewBack} alt="Back" />
                    )}
                  </>
                )}
              </div>

              {/* Item Details */}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>{item.name}</h3>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4ade80', marginBottom: '1rem' }}>
                  {(item.unitPrice || item.total || 0).toFixed(2)} BHD
                </div>

                <ItemCustomizationSummary item={item} lang={lang} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#333', borderRadius: '4px' }}>
                    <button onClick={() => handleQuantityChange(idx, -1)} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}>-</button>
                    <span style={{ padding: '0 1rem' }}>{item.quantity || 1}</span>
                    <button onClick={() => handleQuantityChange(idx, 1)} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}>+</button>
                  </div>

                  <button onClick={() => handleRemove(idx)} style={{ color: '#e53e3e', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    {t('itemRemove') || 'Remove'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Summary Options */}
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ background: '#1c1f28', padding: '1.5rem', borderRadius: '8px', position: 'sticky', top: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>{t('summaryTitle') || 'Summary'}</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>{t('itemsCountLabel') || 'Items'}:</span>
              <span>{totals.count}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>{t('subtotalLabel') || 'Subtotal'}:</span>
              <span>{totals.sum.toFixed(2)} BHD</span>
            </div>

            <hr style={{ borderColor: '#333', margin: '1rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              <span>{t('totalLabelBold') || 'Total'}:</span>
              <span>{totals.sum.toFixed(2)} BHD</span>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="primary-action-btn"
              disabled={cartItems.length === 0}
              style={{ width: '100%', padding: '1rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: cartItems.length > 0 ? 'pointer' : 'not-allowed' }}
            >
              {t('checkoutCta') || 'Proceed to Checkout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
