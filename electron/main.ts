import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, IpcMainEvent } from 'electron';
import { isPrivateOrLoopbackIp } from './netGuard';
import path from 'path';
import { fileURLToPath } from 'url';

// package.json "type":"module" olduğu için __dirname yoktur; ESM karşılığı kullanılır.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { startLocalServer } from './server';
import {
  generateKitchenReceipt,
  generateBillReceipt,
  generateCancelReceipt,
  generateZReportReceipt,
  generateHardwareTestReceipt,
  sendToNetworkPrinter,
  sendToWindowsSpooler
} from './printer';

let mainWindow: BrowserWindow | null = null;

/** IPC yalnızca uygulamanın kendi sayfasından (file:// veya geliştirme sunucusu) kabul edilir. */
function isTrustedSender(event: IpcMainInvokeEvent | IpcMainEvent): boolean {
  const url = event.senderFrame?.url || '';
  const dev = process.env.VITE_DEV_SERVER_URL;
  return url.startsWith('file://') || (!!dev && url.startsWith(dev));
}
function secureHandle(channel: string, fn: (event: IpcMainInvokeEvent, arg: any) => any) {
  ipcMain.handle(channel, (event, arg) => {
    if (!isTrustedSender(event)) return { success: false, error: 'İzinsiz kaynak' };
    return fn(event, arg);
  });
}
function secureOn(channel: string, fn: () => void) {
  ipcMain.on(channel, (event) => {
    if (isTrustedSender(event)) fn();
  });
}
function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function validNetTarget(ip: any, port: any): string | null {
  if (typeof ip !== 'string' || !isPrivateOrLoopbackIp(ip)) return 'Yazıcı adresi yerel ağ (özel IP) olmalıdır.';
  const p = Number(port || 9100);
  if (!Number.isInteger(p) || p < 1 || p > 65535) return 'Geçersiz port.';
  return null;
}

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
      // Güvenli Electron: sayfa Node.js'e doğrudan erişemez; yalnızca preload'daki izinli köprü kullanılır.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Uygulama dışına gezinme ve yeni pencere açma engellenir.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const dev = process.env.VITE_DEV_SERVER_URL;
    if (!(url.startsWith('file://') || (dev && url.startsWith(dev)))) e.preventDefault();
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
secureHandle('get-system-usb-printers', async () => {
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
secureHandle('print-network-ticket', async (event, { ip, port, ticketType, data }) => {
  try {
    const bad = validNetTarget(ip, port);
    if (bad) return { success: false, error: bad };
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

// USB / WINDOWS YAZICISINA SESSİZ FİŞ DÖKÜMÜ & WIN32 RAW SPOOLER
secureHandle('print-usb-receipt', async (event, { printerName, rawText, buffer, html }) => {
  try {
    if (buffer) {
      const spoolRes = await sendToWindowsSpooler(printerName, Buffer.from(buffer));
      return { success: spoolRes.success, error: spoolRes.error };
    }
    if (rawText) {
      const spoolRes = await sendToWindowsSpooler(printerName, Buffer.from(rawText, 'binary'));
      if (spoolRes.success) return { success: true };
    }

    const printWin = new BrowserWindow({
      show: false,
      width: 320,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
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
      <body>${rawText ? escapeHtml(String(rawText)).replace(/\n/g, '<br/>') : ''}</body>
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

// DONANIM TEST YAZDIRMASI (Afanda 892E & Win32 Spooler)
secureHandle('print-hardware-test', async (event, { printerName, type, ip, port }) => {
  try {
    if (type === 'NETWORK') {
      const bad = validNetTarget(ip, port);
      if (bad) return { success: false, error: bad };
    }
    const testBuf = generateHardwareTestReceipt(printerName);
    if (type === 'NETWORK' && ip) {
      const ok = await sendToNetworkPrinter(ip, port || 9100, testBuf);
      return { success: ok };
    }
    const res = await sendToWindowsSpooler(printerName, testBuf);
    return { success: res.success, error: res.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

secureOn('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

secureOn('window-toggle-fullscreen', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

secureOn('window-close', () => {
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
