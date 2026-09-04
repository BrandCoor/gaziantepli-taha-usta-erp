import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { startLocalServer } from './server';
import {
  generateKitchenReceipt,
  generateBillReceipt,
  generateCancelReceipt,
  generateZReportReceipt,
  sendToNetworkPrinter
} from './printer';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    autoHideMenuBar: true,
    title: 'Gaziantepli Taha Usta - Restoran Otomasyon Sistemi',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.maximize();

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// WINDOWS İŞLETİM SİSTEMİNE BAĞLI USB / SPOOLER YAZICILARI GETİR
ipcMain.handle('get-system-usb-printers', async () => {
  if (mainWindow) {
    try {
      const list = await mainWindow.webContents.getPrintersAsync();
      return list.map(p => ({
        name: p.name,
        displayName: p.displayName || p.name,
        isDefault: p.isDefault,
        status: p.status === 0 ? 'ONLINE' : 'READY',
        type: 'USB'
      }));
    } catch (e) {
      return [];
    }
  }
  return [];
});

// AĞ YAZICISINA DOĞRUDAN ELEKTRON ARACILIĞIYLA YAZDIRMA (Port 9100)
ipcMain.handle('print-network-ticket', async (event, { ip, port, ticketType, data }) => {
  try {
    let buffer: Buffer;
    if (ticketType === 'BILL') {
      buffer = generateBillReceipt(data);
    } else if (ticketType === 'CANCEL') {
      buffer = generateCancelReceipt(data);
    } else if (ticketType === 'Z_REPORT') {
      buffer = generateZReportReceipt(data);
    } else {
      buffer = generateKitchenReceipt(data);
    }
    const success = await sendToNetworkPrinter(ip, port || 9100, buffer);
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// USB / WINDOWS YAZICISINA SESSİZ FİŞ DÖKÜMÜ
ipcMain.handle('print-usb-receipt', async (event, { printerName, rawText, html }) => {
  try {
    const printWin = new BrowserWindow({
      show: false,
      width: 320,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    const contentHtml = html || `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: monospace, 'Courier New', Courier; font-size: 12px; margin: 2mm; padding: 0; white-space: pre-wrap; word-break: break-all; color: #000; }
        </style>
      </head>
      <body>${rawText ? rawText.replace(/\n/g, '<br/>') : ''}</body>
      </html>
    `;

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(contentHtml)}`);

    return new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: printerName || undefined,
        },
        (success, failureReason) => {
          printWin.close();
          resolve({ success, failureReason });
        }
      );
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-toggle-fullscreen', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  startLocalServer(4545);
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
