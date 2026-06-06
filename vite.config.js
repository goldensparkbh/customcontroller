import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const DEV_API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      /*
       * Point at the DigitalOcean-era Node backend (express in /server).
       * Override via VITE_DEV_API_TARGET=http://127.0.0.1:8787 npm run dev
       */
      '/zoho': { target: DEV_API_TARGET, changeOrigin: true, secure: false },
      '/api': { target: DEV_API_TARGET, changeOrigin: true, secure: false },
      '/store-api': { target: DEV_API_TARGET, changeOrigin: true, secure: false },
      '/admin-api': { target: DEV_API_TARGET, changeOrigin: true, secure: false },
    },
  },
});
