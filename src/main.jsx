import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import App from './App.jsx';
import { db } from './firebase.js';
import { applyTranslationOverrideEntries, i18n } from './i18n.js';
import { TRANSLATION_OVERRIDES_DOC } from './translationMerge.js';
import './index.css';

window.__EZ_I18N__ = i18n;

const chunkReloadGuardKey = '__ez_chunk_reload__';

try {
  if (
    Object.prototype.hasOwnProperty.call(window, '__chromium_devtools_metrics_reporter') &&
    typeof window.__chromium_devtools_metrics_reporter !== 'function'
  ) {
    window.__chromium_devtools_metrics_reporter = () => {};
  }
} catch {
  // Ignore injected Chromium/extension globals we cannot safely rewrite.
}

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = typeof reason === 'string' ? reason : String(reason?.message || '');
  const reasonName = String(reason?.name || '');

  // The app does not use Apollo. Suppress extension/devtools-injected Apollo 403 noise.
  if (reasonName === 'ApolloError' && message.includes('Response not successful: Received status code 403')) {
    event.preventDefault();
  }
});

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();

  if (window.sessionStorage.getItem(chunkReloadGuardKey) === '1') {
    window.sessionStorage.removeItem(chunkReloadGuardKey);
    return;
  }

  window.sessionStorage.setItem(chunkReloadGuardKey, '1');
  window.location.reload();
});

window.addEventListener('pageshow', () => {
  window.sessionStorage.removeItem(chunkReloadGuardKey);
});

const router = createBrowserRouter(
  [
    {
      path: '/*',
      element: <App />,
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

function TranslationBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ref = doc(db, TRANSLATION_OVERRIDES_DOC[0], TRANSLATION_OVERRIDES_DOC[1]);
        const snap = await getDoc(ref);
        if (!cancelled && snap.exists()) {
          const entries = snap.data()?.entries;
          if (entries && typeof entries === 'object') {
            applyTranslationOverrideEntries(entries);
          }
        }
      } catch (err) {
        console.warn('[i18n] Translation overrides load failed', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0d1117',
          color: '#8b949e'
        }}
      >
        …
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<TranslationBootstrap />);
