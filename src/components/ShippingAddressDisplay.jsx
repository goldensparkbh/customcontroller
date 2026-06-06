import React from 'react';
import { getShippingAddressFields } from '../utils/shippingAddress.js';
import { adminAlign } from '../pages/admin/adminUi.js';

export default function ShippingAddressDisplay({ shipping, lang = 'ar', isAr, compact = false }) {
  const fields = getShippingAddressFields(shipping, { lang: lang === 'ar' ? 'ar' : 'en' });
  const align = adminAlign(isAr);

  if (!fields.length) {
    return <div style={{ color: '#8b949e' }}>N/A</div>;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: compact ? '0.55rem' : '0.75rem',
        textAlign: align
      }}
    >
      {fields.map((field) => (
        <div key={field.key} style={{ display: 'grid', gap: '0.2rem', minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.72rem',
              color: '#8b949e',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}
          >
            {field.label}
          </div>
          <div style={{ color: '#e6edf3', lineHeight: 1.45, wordBreak: 'break-word' }}>{field.value}</div>
        </div>
      ))}
    </div>
  );
}
