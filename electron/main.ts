import { app, BrowserWindow } from 'electron';
import path from 'path';
import { startLocalServer } from './server';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Gaziantepli Taha Usta - Restoran Otomasyon Sistemi',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Geliştirme ortamında Vite yerel portunu dinle
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // 1. Kasa Yerel API ve WebSocket Sunucusunu Başlat
  startLocalServer(4545);

  // 2. Ana Masaüstü Arayüzünü Aç
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
