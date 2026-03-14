import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/zoho': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        secure: false,
      },
      '/api/tap/verify': {
        target: 'http://localhost:5001/ps5-controller/us-central1/tapVerificationHandler',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tap\/verify/, ''),
      },
      '/api/tap': {
        target: 'http://localhost:5001/ps5-controller/us-central1/tapPaymentHandler',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tap/, ''),
      },
      '/api/orderPreview': {
        target: 'http://localhost:5001/ps5-controller/us-central1/orderPreview',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/orderPreview/, ''),
      },
      '/api': {
        target: 'http://localhost:5001/ps5-controller/us-central1/orderHandler',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
