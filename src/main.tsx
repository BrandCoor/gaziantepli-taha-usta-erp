import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { installCloudAuth } from './services/cloudAuth';

installCloudAuth();

// Yakalanmamış arayüz hataları ana süreçteki günlük dosyasına yazılır (masaüstü uygulamasında).
const reportError = (msg: string) => { try { (window as any).electronAPI?.invoke('log-renderer-error', { message: msg }); } catch {} };
window.addEventListener('error', (e) => reportError(`${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => reportError('Promise reddi: ' + String((e.reason && e.reason.stack) || e.reason)));

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);