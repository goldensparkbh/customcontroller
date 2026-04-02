import React, { useState, useEffect, useRef } from 'react';
import { i18n } from '../i18n.js';
import { LoadingInline } from '../components/LoadingState.jsx';
import ItemCustomizationSummary from '../components/ItemCustomizationSummary.jsx';

const arabCountries = ["BH", "SA", "AE", "KW", "OM", "QA", "EG", "JO"];

const PreviewStack = ({ layers, fallbackSrc }) => (
  <div className="checkout-preview-stack" style={{ position: 'relative', width: '100px', height: '65px', background: '#111', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
    {Array.isArray(layers) && layers.length > 0 ? (
      layers.map((layer, idx) => (
        <img
          key={`${layer.src || 'layer'}-${idx}`}
          src={layer.src}
          alt={idx === 0 ? "Preview" : ''}
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
      <img src={fallbackSrc || "/assets/controller.png"} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    )}
  </div>
);

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const getTapPublicKey = () => String(import.meta.env.VITE_TAP_PUBLIC_KEY || '').trim();

function buildTapChargeBody(orderData, origin) {
  const customerName = orderData.fullName || 'Guest';
  const [firstName, ...restName] = customerName.split(/\s+/).filter(Boolean);
  const lastName = restName.join(' ') || firstName || '.';
  const postUrl = origin.includes('localhost')
    ? 'http://localhost:5001/ps5-controller/us-central1/tapWebhook'
    : undefined;

  return {
    amount: orderData.total,
    currency: orderData.currency || 'BHD',
    customer: {
      first_name: firstName || 'Customer',
      last_name: lastName,
      email: orderData.email || 'customer@example.com',
      phone: {
        country_code: orderData.phonePrefix || '973',
        number: String(orderData.phone || '').replace(/\D/g, '') || '00000000'
      }
    },
    redirect_url: `${origin}/payment/success`,
    post_url: postUrl,
    public_key: getTapPublicKey()
  };
}

function getOrCreateAbandonSessionId() {
  try {
    let s = localStorage.getItem('ezAbandonSession');
    if (!s) {
      s = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ez_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('ezAbandonSession', s);
    }
    return s;
  } catch {
    return `ez_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const CheckoutPage = () => {
  const formRef = useRef(null);
  const [lang, setLang] = useState('ar');
  const [cartItems, setCartItems] = useState([]);
  const [abandonSessionId] = useState(() => getOrCreateAbandonSessionId());
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountMessage, setDiscountMessage] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phonePrefix: '973',
    phone: '',
    email: '',
    country: 'BH',
    shippingType: 'delivery',
    city: '',
    state: '',
    saudiUnifiedAddress: '',
    address: '',
    blockNumber: '',
    roadNumber: '',
    houseBuildingNumber: '',
    flat: '',
    agree: false
  });

  const [loadingAction, setLoadingAction] = useState('');

  useEffect(() => {
    document.body.classList.add('checkout-page-active');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    try {
      const raw = localStorage.getItem("ezCart");
      if (raw) setCartItems(JSON.parse(raw));
    } catch (e) { }
    return () => {
      document.body.classList.remove('checkout-page-active');
      document.documentElement.style.overflowY = '';
      document.body.style.overflowY = '';
    };
  }, []);

  const t = (key) => (i18n[lang] && i18n[lang][key]) ? i18n[lang][key] : key;

  // Calculation Logic
  const itemsCount = cartItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
  const subtotal = cartItems.reduce((acc, item) => acc + ((item.unitPrice || item.total || 0) * (item.quantity || 1)), 0);

  const isBahrain = formData.country === 'BH';
  const isSaudi = formData.country === 'SA';
  const requiresAddress = isBahrain ? formData.shippingType === 'delivery' : true;

  let shippingCost = 0;
  if (isBahrain) {
    shippingCost = formData.shippingType === 'pickup' ? 0 : 2.00;
  } else {
    const pairs = Math.ceil(itemsCount / 2);
    shippingCost = pairs * 5.00;
  }

  const discountAmount = appliedDiscount && Number(appliedDiscount.amount) > 0 ? Number(appliedDiscount.amount) : 0;
  const totalDue = Math.max(0, subtotal + shippingCost - discountAmount);
  const isLoading = loadingAction !== '';

  const cartFingerprint = JSON.stringify(
    (cartItems || []).map((i) => ({
      k: i.cartKey || i.id || i.name,
      q: i.quantity || 1,
      u: i.unitPrice ?? i.total ?? 0
    }))
  );

  useEffect(() => {
    setAppliedDiscount(null);
    setDiscountMessage('');
  }, [cartFingerprint, formData.shippingType, formData.country]);
  const shippingOptions = [
    { value: 'delivery', label: t('shippingBahrainDelivery') || 'توصيل - خلال 6-7 أيام عمل (2 د.ب)' },
    { value: 'pickup', label: t('shippingBahrainPickup') || 'استلام من المتجر (مجاني)' }
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const buildOrderData = () => {
    const composedAddress = [
      isSaudi && formData.saudiUnifiedAddress ? `Unified Address ${formData.saudiUnifiedAddress}` : '',
      formData.address,
      formData.blockNumber ? `Block ${formData.blockNumber}` : '',
      formData.roadNumber ? `Road ${formData.roadNumber}` : '',
      formData.houseBuildingNumber ? `House/Building ${formData.houseBuildingNumber}` : '',
      formData.flat ? `Flat ${formData.flat}` : ''
    ].filter(Boolean).join(', ');

    // Final inventory stock validation before proceeding
    const stockUsage = new Map();
    cartItems.forEach(item => {
      const itemQty = item.quantity || 1;
      if (!item.parts) return;
      Object.entries(item.parts).forEach(([partId, partState]) => {
        const partLabel = (i18n[lang]?.parts && i18n[lang].parts[partId]) || partId;

        // Color
        if (partState.color?.id || partState.color?.key) {
          const key = `configurator_parts/${partId}/options/${partState.color.id || partState.color.key}`;
          const stock = partState.color.qty != null ? partState.color.qty : 999;
          const optionName = partState.color.valName || partState.color.name || "";
          const displayName = `${partLabel}: ${optionName}`;
          const existing = stockUsage.get(key) || { used: 0, stock, displayName };
          existing.used += itemQty;
          stockUsage.set(key, existing);
        }
        // Options
        const opts = Array.isArray(partState.options) ? partState.options : (partState.option ? [partState.option] : []);
        opts.forEach(o => {
          const key = `configurator_parts/${partId}/options/${o.id || o.key}`;
          const stock = o.qty != null ? o.qty : 999;
          const optionName = o.valName || o.name || "";
          const displayName = `${partLabel} (${optionName})`;
          const existing = stockUsage.get(key) || { used: 0, stock, displayName };
          existing.used += itemQty;
          stockUsage.set(key, existing);
        });
      });
    });

    const limitedItems = [];
    for (const info of stockUsage.values()) {
      if (info.used > info.stock) {
        limitedItems.push(`${info.displayName} [${info.stock} available]`);
      }
    }

    if (limitedItems.length > 0) {
      const msg = (lang === 'ar')
        ? `عذرًا ، لا يمكن إكمال الطلب. هناك كمية محدودة متاحة للمواد التالية:\n- ${limitedItems.join('\n- ')}`
        : `Sorry, cannot complete the order. The following items have limited availability and exceed stock limits:\n- ${limitedItems.join('\n- ')}`;
      alert(msg);
      throw new Error("stock_limit_reached");
    }

    const orderData = {
      ...formData,
      subtotal,
      shippingCost,
      total: totalDue,
      currency: 'BHD',
      currencyPrefix: 'BHD ',
      itemsCount,
      cart: cartItems,
      fullName: `${formData.firstName} ${formData.lastName}`.trim(),
      phoneFull: `+${formData.phonePrefix}${formData.phone}`,
      shippingMethod: isBahrain ? formData.shippingType : 'international',
      addressLine1: composedAddress,
      abandonSessionId,
      discountCode: appliedDiscount?.code || '',
      discountAmount: discountAmount || 0
    };

    if (!requiresAddress) {
      orderData.addressLine1 = 'Store Pickup';
      orderData.address = 'Store Pickup';
      orderData.city = 'Manama';
      orderData.state = '';
      orderData.saudiUnifiedAddress = '';
      orderData.blockNumber = '';
      orderData.roadNumber = '';
      orderData.houseBuildingNumber = '';
      orderData.flat = '';
    }

    return orderData;
  };

  const handleApplyDiscount = async () => {
    const code = discountInput.trim();
    if (!code) return;
    setDiscountLoading(true);
    setDiscountMessage('');
    try {
      const payload = {
        code,
        cart: cartItems,
        subtotal,
        shippingCost,
        total: subtotal + shippingCost
      };
      const res = await fetch('/api/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data?.success) {
        setAppliedDiscount(null);
        setDiscountMessage(t('discountInvalid') || data?.error || 'Invalid code');
        return;
      }
      setAppliedDiscount({ code: data.code, amount: data.discountAmount });
      setDiscountMessage(t('discountApplied') || 'Discount applied');
    } catch (err) {
      console.error(err);
      setAppliedDiscount(null);
      setDiscountMessage(t('discountInvalid') || 'Invalid code');
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formRef.current?.reportValidity()) return;
    if (cartItems.length === 0) return alert(t('alertNoItems') || 'Cart is empty');

    const tapPk = getTapPublicKey();
    if (!tapPk) {
      alert(t('tapPublicKeyMissing'));
      return;
    }

    setLoadingAction('payment');

    try {
      const orderData = buildOrderData();
      localStorage.removeItem('ezOrderResult');
      localStorage.setItem('ezOrderDraft', JSON.stringify(orderData));

      if (!(Number(orderData.total) > 0)) {
        throw new Error('Invalid order total');
      }

      const response = await fetch('/api/tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTapChargeBody(orderData, window.location.origin))
      });
      const result = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error((result && (result.error || result.detail || result.message)) || `HTTP ${response.status}`);
      }

      if (!result?.transaction?.url) {
        throw new Error('No payment URL received');
      }

      fetch('/api/abandonedCart/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      }).catch(() => {});

      window.location.href = result.transaction.url;
    } catch (err) {
      console.error(err);
      if (err.message !== 'stock_limit_reached') {
        alert(`${t('paymentStartFailed') || 'Failed to start payment'}${err.message ? `: ${err.message}` : ''}`);
      }
      setLoadingAction('');
    }
  };

  return (
    <div className="checkout-page checkout-shell" style={{ background: '#0b0b0f', minHeight: '100vh', color: '#fff', paddingBottom: '2rem' }}>

      {/* Removed Top Nav */}

      <div className="checkout-layout" style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: '2rem', padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Left: Form */}
        <div className="checkout-form-panel" style={{ flex: '2 1 600px', background: '#1c1f28', padding: '2rem', borderRadius: '8px' }}>
          <form className="checkout-form-stack" ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isBahrain && (
              <div className="checkout-shipping-box" style={{ background: '#222', padding: '1rem', borderRadius: '4px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('shippingMethodLabel') || 'Shipping Method'}</label>
                <div className="checkout-shipping-toggle" role="radiogroup" aria-label={t('shippingMethodLabel') || 'Shipping Method'}>
                  {shippingOptions.map((option) => {
                    const isActive = formData.shippingType === option.value;
                    return (
                      <label key={option.value} className={`checkout-shipping-option${isActive ? ' active' : ''}`}>
                        <input
                          className="checkout-shipping-input"
                          type="radio"
                          name="shippingType"
                          value={option.value}
                          checked={isActive}
                          onChange={handleChange}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <h2 style={{ margin: '0 0 1.5rem 0' }}>{t('formTitle') || 'Customer & Payment Details'}</h2>

            <div className="checkout-row checkout-row-split" style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label>{t('firstNameLabel') || 'First Name'} *</label>
                <input name="firstName" value={formData.firstName} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label>{t('lastNameLabel') || 'Last Name'} *</label>
                <input name="lastName" value={formData.lastName} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
              </div>
            </div>

            <div className="checkout-row checkout-row-split" style={{ display: 'flex', gap: '1rem' }}>
              <div className="checkout-phone-code" style={{ flex: '0 0 120px' }}>
                <label>{t('phonePrefixLabel') || 'Code'} *</label>
                <select name="phonePrefix" value={formData.phonePrefix} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}>
                  <option value="973">+973 (BH)</option>
                  <option value="966">+966 (SA)</option>
                  <option value="971">+971 (AE)</option>
                  <option value="965">+965 (KW)</option>
                  <option value="968">+968 (OM)</option>
                  <option value="974">+974 (QA)</option>
                  <option value="20">+20 (EG)</option>
                  <option value="962">+962 (JO)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label>{t('phoneLabel') || 'Phone'} *</label>
                <input name="phone" value={formData.phone} onChange={handleChange} required type="text" inputMode="numeric" autoComplete="tel-national" style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
              </div>
            </div>

            <div>
              <label>{t('emailLabel') || 'Email *'}</label>
              <input name="email" value={formData.email} onChange={handleChange} type="email" required autoComplete="email" style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
            </div>

            <div>
              <label>{t('countryLabel') || 'Country'} *</label>
              <select name="country" value={formData.country} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}>
                {arabCountries.map(code => (
                  <option key={code} value={code}>
                    {i18n[lang]?.arabCountries?.[code] || code}
                  </option>
                ))}
              </select>
            </div>

            {requiresAddress && (
              <div className="checkout-address-box" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#222', padding: '1rem', borderRadius: '4px' }}>
                {isSaudi && (
                  <div>
                    <label>{t('saudiUnifiedAddressLabel') || 'الرجاء وضع العنوان الموحد'} *</label>
                    <input name="saudiUnifiedAddress" value={formData.saudiUnifiedAddress} onChange={handleChange} required={isSaudi} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
                  </div>
                )}

                <div className="checkout-row checkout-row-split" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <label>{t('cityLabel') || 'City'} *</label>
                    <input name="city" value={formData.city} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <label>{t('stateLabel') || 'State'} *</label>
                    <input name="state" value={formData.state} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
                  </div>
                </div>

                <div>
                  <label>{t('addressLabel') || 'Address'} *</label>
                  <input name="address" value={formData.address} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
                </div>

                <div className="checkout-row checkout-row-split" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <label>{t('blockNumberLabel') || 'Block Number'} *</label>
                    <input name="blockNumber" value={formData.blockNumber} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <label>{t('roadNumberLabel') || 'Road Number'} *</label>
                    <input name="roadNumber" value={formData.roadNumber} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
                  </div>
                </div>

                <div className="checkout-row checkout-row-split" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <label>{t('houseBuildingNumberLabel') || 'House/Building Number'} *</label>
                    <input name="houseBuildingNumber" value={formData.houseBuildingNumber} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <label>{t('flatLabel') || 'Flat'}</label>
                    <input name="flat" value={formData.flat} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input type="checkbox" name="agree" checked={formData.agree} onChange={handleChange} required id="agreeCb" style={{ marginTop: '0.2rem' }} />
              <label htmlFor="agreeCb" style={{ fontSize: '0.9rem', color: '#ccc' }}>
                {t('termsText') || 'I agree that all customization data is correct, and I accept the terms and conditions.'}
              </label>
            </div>

            <button type="submit" className="primary-action-btn" disabled={isLoading} style={{ padding: '1rem', fontWeight: 'bold', fontSize: '1.2rem', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '1rem' }}>
              {loadingAction === 'payment'
                ? <LoadingInline label={t('paymentProcessing') || 'Processing...'} />
                : (t('placeOrderBtn') || 'Place Order')}
            </button>
          </form>
        </div>

        {/* Right: Order Summary */}
        <div className="checkout-summary-column" style={{ flex: '1 1 300px' }}>
          <div className="checkout-summary-card" style={{ background: '#1c1f28', padding: '1.5rem', borderRadius: '8px', position: 'sticky', top: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0' }}>{t('summaryTitle') || 'Order Summary'}</h3>

            {cartItems.length === 0 ? (
              <p style={{ color: '#aaa' }}>{t('summaryEmpty') || 'Cart is empty.'}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {cartItems.map((item, idx) => (
                  <div key={idx} className="checkout-summary-item" style={{ paddingBottom: '1rem', borderBottom: '1px solid #333' }}>
                    <PreviewStack layers={item.previewFrontLayers} fallbackSrc={item.previewFront || "/assets/controller.png"} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span>{item.name} x {item.quantity || 1}</span>
                      <span>{((item.unitPrice || item.total || 0) * (item.quantity || 1)).toFixed(2)} BHD</span>
                    </div>
                    <ItemCustomizationSummary item={item} lang={lang} compact />
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ccc' }}>
              <span>{t('itemsCountLabel')}:</span>
              <span>{itemsCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ccc' }}>
              <span>{t('subtotalLabel')}:</span>
              <span>{subtotal.toFixed(2)} {t('currencyPrefix') || 'BHD'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ccc' }}>
              <span>{t('shippingLabel')}:</span>
              <span>{shippingCost.toFixed(2)} {t('currencyPrefix') || 'BHD'}</span>
            </div>

            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#4ade80' }}>
                <span>{t('discountLabel') || 'Discount'}:</span>
                <span>-{discountAmount.toFixed(2)} {t('currencyPrefix') || 'BHD'}</span>
              </div>
            )}

            <hr style={{ borderColor: '#333', margin: '1rem 0' }} />

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem', color: '#ccc' }}>
                {t('discountCodeLabel') || 'Discount code'}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder={t('discountCodePlaceholder') || ''}
                  autoComplete="off"
                  style={{ flex: '1 1 160px', padding: '0.5rem', minWidth: 0 }}
                />
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  disabled={discountLoading || !discountInput.trim()}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #30363d',
                    background: '#21262d',
                    color: '#e6edf3',
                    cursor: discountLoading ? 'wait' : 'pointer',
                    fontWeight: 600
                  }}
                >
                  {discountLoading ? '…' : (t('discountApply') || 'Apply')}
                </button>
              </div>
              {discountMessage && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: appliedDiscount ? '#4ade80' : '#f87171' }}>
                  {discountMessage}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', color: '#4ade80' }}>
              <span>{t('totalDueLabel')}:</span>
              <span>{totalDue.toFixed(2)} {t('currencyPrefix') || 'BHD'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CheckoutPage;
