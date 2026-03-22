import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App.jsx';
import { i18n } from './i18n.js';
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <RouterProvider router={router} />
);
