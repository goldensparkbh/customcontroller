import React from 'react';
import { CURRENCIES } from '../lib/currencies.js';
import { useCurrency } from '../context/CurrencyContext.jsx';

const controlStyle = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.18)',
  color: 'var(--color-text)',
  padding: '0.5rem 0.65rem',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem',
  maxWidth: '7.5rem'
};

export default function CurrencySelect() {
  const { currency, setCurrency, ratesLoading } = useCurrency();
  const lang = localStorage.getItem('ez_lang') || 'ar';

  return (
    <select
      aria-label={lang === 'ar' ? 'العملة' : 'Currency'}
      value={currency}
      disabled={ratesLoading}
      onChange={(e) => setCurrency(e.target.value)}
      style={controlStyle}
      className="currency-select"
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code} style={{ color: '#111' }}>
          {c.code}
        </option>
      ))}
    </select>
  );
}
