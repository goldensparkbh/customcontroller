import React from 'react';
import { i18n } from '../i18n.js';
import { getItemCustomizationGroups } from '../utils/itemCustomization.js';

const ItemCustomizationSummary = ({ item, lang = 'ar', compact = false }) => {
  const t = (key) => (i18n[lang] && i18n[lang][key]) ? i18n[lang][key] : key;
  const partLabels = i18n[lang]?.parts || {};
  const groups = getItemCustomizationGroups(item, partLabels);

  if (!groups.colors.length && !groups.options.length && !groups.legacy.length) {
    return null;
  }

  const headingStyle = {
    fontSize: compact ? '0.75rem' : '0.78rem',
    fontWeight: 700,
    color: '#e6edf3'
  };
  const bodyStyle = {
    display: 'grid',
    gap: compact ? '0.28rem' : '0.32rem',
    color: compact ? '#b6c2d0' : '#c7d2de',
    fontSize: compact ? '0.78rem' : '0.9rem',
    lineHeight: 1.45
  };

  return (
    <div style={{ display: 'grid', gap: compact ? '0.55rem' : '0.7rem', marginTop: compact ? '0.6rem' : '0.75rem' }}>
      <div style={{ fontSize: compact ? '0.72rem' : '0.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {t('itemDetailsHeading') || 'Customization details:'}
      </div>

      {groups.colors.length > 0 && (
        <div style={{ display: 'grid', gap: compact ? '0.28rem' : '0.35rem' }}>
          <div style={headingStyle}>{t('partsColorsHeading') || 'Color Options'}</div>
          <div style={bodyStyle}>
            {groups.colors.map((entry) => (
              <div key={`color-${entry.partId}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span
                  style={{
                    width: compact ? '10px' : '12px',
                    height: compact ? '10px' : '12px',
                    borderRadius: '50%',
                    background: entry.swatch || '#8b949e',
                    border: '1px solid rgba(255,255,255,0.25)',
                    flexShrink: 0
                  }}
                />
                <span>
                  <strong style={{ color: '#e6edf3' }}>{entry.partLabel}:</strong> {entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {groups.options.length > 0 && (
        <div style={{ display: 'grid', gap: compact ? '0.28rem' : '0.35rem' }}>
          <div style={headingStyle}>{t('partsOptionsHeading') || 'Performance / Options'}</div>
          <div style={bodyStyle}>
            {groups.options.map((entry) => (
              <div key={`option-${entry.partId}-${entry.value}`}>
                <strong style={{ color: '#e6edf3' }}>{entry.partLabel}:</strong> {entry.value}
              </div>
            ))}
          </div>
        </div>
      )}

      {groups.legacy.length > 0 && (
        <div style={bodyStyle}>
          {groups.legacy.map((entry) => (
            <div key={`legacy-${entry.key}`}>
              <strong style={{ color: '#e6edf3' }}>{entry.key}:</strong> {entry.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ItemCustomizationSummary;
