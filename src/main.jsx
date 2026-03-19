import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App.jsx';
import { i18n } from './i18n.js';
import './index.css';

window.__EZ_I18N__ = i18n;

const chunkReloadGuardKey = '__ez_chunk_reload__';

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
