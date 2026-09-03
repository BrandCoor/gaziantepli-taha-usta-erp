import { app, BrowserWindow, Menu, ipcMain, nativeImage } from 'electron';
import path from 'path';

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 650,
    frame: false,
    autoHideMenuBar: true,
    title: 'Gaziantepli Taha Usta',
    focusable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.maximize();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Pencere Kontrolleri
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
  app.quit();
});

ipcMain.on('update-app-icon', (event, circularBase64Icon) => {
  if (circularBase64Icon && mainWindow) {
    try {
      const image = nativeImage.createFromDataURL(circularBase64Icon);
      if (!image.isEmpty()) {
        mainWindow.setIcon(image);
      }
    } catch (e) {
      console.error('İkon hatası:', e);
    }
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});