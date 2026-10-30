import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Wrangler rewrites URL and Host; preserve the browser host for local routing.
            proxyReq.setHeader('X-Cafe-Dev-Host', req.headers.host || 'localhost:3000');
            proxyReq.removeHeader('X-Cafe-Dev-Origin');
            if (req.headers.origin) proxyReq.setHeader('X-Cafe-Dev-Origin', encodeURIComponent(req.headers.origin));
          });
        }
      }
    }
  }
});
