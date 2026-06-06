import React, { useState } from 'react';

const DEFAULT_AR =
  'الموقع قيد الصيانة حالياً. نعمل على تحسين تجربتكم وسنعود قريباً. شكراً لصبركم.';
const DEFAULT_EN =
  'This website is under maintenance. We are improving your experience and will be back soon. Thank you for your patience.';

export default function MaintenancePage({ messageAr, messageEn }) {
  const [lang, setLang] = useState(() => localStorage.getItem('ez_lang') || 'ar');
  const isAr = lang === 'ar';

  const toggleLang = () => {
    const next = isAr ? 'en' : 'ar';
    setLang(next);
    localStorage.setItem('ez_lang', next);
  };

  const title = isAr ? 'الموقع قيد الصيانة' : 'Under maintenance';
  const body = isAr ? messageAr || DEFAULT_AR : messageEn || DEFAULT_EN;
  const langLabel = isAr ? 'English' : 'العربية';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        background: 'linear-gradient(160deg, #0d1117 0%, #161b22 45%, #1c2128 100%)',
        color: '#e6edf3',
        direction: isAr ? 'rtl' : 'ltr',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif'
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          display: 'grid',
          gap: '1.25rem',
          padding: '2.5rem 2rem',
          borderRadius: '16px',
          border: '1px solid #30363d',
          background: 'rgba(22, 27, 34, 0.92)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35)'
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            margin: '0 auto',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(88, 166, 255, 0.12)',
            border: '1px solid rgba(88, 166, 255, 0.35)',
            fontSize: '1.75rem'
          }}
          aria-hidden
        >
          ⚙
        </div>
        <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
        <p style={{ margin: 0, color: '#8b949e', lineHeight: 1.7, fontSize: '1.05rem' }}>{body}</p>
        <button
          type="button"
          onClick={toggleLang}
          style={{
            marginTop: '0.5rem',
            justifySelf: 'center',
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: '1px solid #30363d',
            background: '#21262d',
            color: '#58a6ff',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        >
          {langLabel}
        </button>
      </div>
    </div>
  );
}
