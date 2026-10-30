import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { installCloudAuth } from './services/cloudAuth';
import { bootstrapDurableStorage } from './services/durableStorage';

installCloudAuth();

// Yakalanmamış arayüz hataları ana süreçteki günlük dosyasına yazılır (masaüstü uygulamasında).
const reportError = (msg: string) => { try { (window as any).electronAPI?.invoke('log-renderer-error', { message: msg }); } catch {} };
window.addEventListener('error', (e) => reportError(`${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => reportError('Promise reddi: ' + String((e.reason && e.reason.stack) || e.reason)));

// ÖNEMLİ: Uygulama modülleri (servisler açılışta localStorage okur) ancak kalıcı depo yüklendikten SONRA içe aktarılır.
bootstrapDurableStorage()
  .catch(() => undefined)
  .then(() => import('./App'))
  .then(({ default: App }) => {
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
