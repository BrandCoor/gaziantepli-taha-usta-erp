import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

// Cloud web sandbox ortamında (ekran/X11 bulunmayan headless container) Electron başlatmayı engelle,
// ancak kullanıcının yerel Windows/Mac/Linux masaüstünde 'npm run dev' çalıştırıldığında masaüstü penceresini aç
const isCloudHeadless = Boolean(process.env.APPLET_ID || process.env.K_SERVICE || process.env.CLOUD_CONTAINER);

export default defineConfig({
  plugins: [
    react(),
    ...(!isCloudHeadless
      ? [
          electron([
            {
              entry: 'electron/main.ts',
            },
          ]),
          renderer(),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});

