import React from 'react';
import { i18n } from '../i18n.js';
import { useCheckoutCountry } from '../context/CheckoutCountryContext.jsx';

const controlStyle = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.18)',
  color: 'var(--color-text)',
  padding: '0.5rem 0.65rem',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem',
  maxWidth: '9.5rem'
};

export default function CheckoutCountrySelect() {
  const { country, setCountry, countries } = useCheckoutCountry();
  const lang = localStorage.getItem('ez_lang') || 'ar';
  const dict = i18n[lang] || i18n.en || {};

  return (
    <select
      aria-label={dict.countryLabel || (lang === 'ar' ? 'الدولة' : 'Country')}
      value={country}
      onChange={(e) => setCountry(e.target.value)}
      style={controlStyle}
      className="checkout-country-select"
    >
      {countries.map((code) => (
        <option key={code} value={code} style={{ color: '#111' }}>
          {dict.arabCountries?.[code] || code}
        </option>
      ))}
    </select>
  );
}
