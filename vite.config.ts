import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import electron from 'vite-plugin-electron';

// Cloud web sandbox ortamında (ekran/X11 bulunmayan headless container) Electron başlatmayı engelle,
// ancak kullanıcının yerel Windows/Mac/Linux masaüstünde 'npm run dev' çalıştırıldığında masaüstü penceresini aç
const isCloudHeadless = Boolean(process.env.APPLET_ID || process.env.K_SERVICE || process.env.CLOUD_CONTAINER);

// Üretim derlemesine İçerik Güvenliği Politikası (CSP) ekler. Geliştirme sunucusu (HMR) etkilenmez.
const cspPlugin = () => ({
  name: 'gtu-csp',
  apply: 'build' as const,
  transformIndexHtml(html: string) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' http: https: ws://127.0.0.1:4545 ws://localhost:4545",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-src 'none'",
    ].join('; ');
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
  },
});

export default defineConfig({
  plugins: [
    cspPlugin(),
    react(),
    ...(!isCloudHeadless
      ? [
          electron([
            {
              entry: 'electron/main.ts',
              vite: {
                build: {
                  rollupOptions: {
                    external: [
                      'serialport',
                      '@serialport/parser-readline',
                      'node-hid',
                      'electron',
                      'fs',
                      'path',
                      'net',
                      'os',
                      'child_process',
                      'events',
                      'http',
                      'ws',
                      'express',
                      'cors',
                      'node:sqlite',
                      'url',
                    ],
                  },
                },
              },
            },
            {
              // Güvenli köprü (contextBridge). Sandbox'lı pencere için CommonJS çıktı gerekir.
              entry: 'electron/preload.ts',
              vite: {
                build: {
                  lib: { entry: 'electron/preload.ts', formats: ['cjs'], fileName: () => 'preload.cjs' },
                  rollupOptions: { external: ['electron'] },
                },
              },
              onstart(options) {
                options.reload();
              },
            },
          ]),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        'serialport',
        '@serialport/parser-readline',
        'node-hid',
        'electron',
      ],
    },
  },
  optimizeDeps: {
    exclude: [
      'serialport',
      '@serialport/parser-readline',
      'node-hid',
      'electron',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});

