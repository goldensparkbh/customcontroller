import React from 'react';

export const LoadingInline = ({ label = 'Loading...', size = 22, textTransform = 'none' }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem' }}>
    <img
      src="/assets/loading.gif"
      alt=""
      aria-hidden="true"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
    <span style={{ textTransform }}>{label}</span>
  </span>
);

const LoadingState = ({
  message = 'Loading...',
  minHeight = '40vh',
  fullScreen = false,
  size = 108
}) => (
  <div
    style={{
      minHeight: fullScreen ? '100vh' : minHeight,
      display: 'grid',
      placeItems: 'center',
      padding: '2rem',
      background: fullScreen ? '#0e1117' : 'transparent',
      color: '#e6edf3'
    }}
  >
    <div style={{ display: 'grid', justifyItems: 'center', gap: '0.85rem', textAlign: 'center' }}>
      <img
        src="/assets/loading.gif"
        alt="Loading"
        style={{ width: size, height: 'auto', objectFit: 'contain' }}
      />
      <div style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.04em' }}>
        {message}
      </div>
    </div>
  </div>
);

export default LoadingState;
