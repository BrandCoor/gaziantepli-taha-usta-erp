import { app, BrowserWindow, ipcMain, dialog, shell, IpcMainInvokeEvent, IpcMainEvent } from 'electron';
import * as fs from 'fs';
import { isPrivateOrLoopbackIp } from './netGuard';
import { BackupStore } from './backupStore';
import { FileLogger } from './logger';
import { KvStore } from './kvStore';
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
import { buildTicketBuffer } from './receiptBuilder';

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

// ===================== KALICI DEPO (SQLite) =====================
// localStorage yazmaları Chromium tarafından gecikmeli diske yazılır; çökmede kaybolur. Asıl kaynak bu SQLite deposudur.
let kv: KvStore | null = null;
const kvOrThrow = (): KvStore => {
  if (!kv) throw new Error('Kalıcı depo açık değil');
  return kv;
};
secureHandle('kv-load-all', async () => {
  try { return { success: true, entries: kvOrThrow().getAll() }; } catch (e: any) { return { success: false, error: e?.message || String(e) }; }
});
secureHandle('kv-set', async (_e, { key, value }) => {
  try { kvOrThrow().set(String(key), String(value)); return { success: true }; } catch (e: any) { return { success: false, error: e?.message || String(e) }; }
});
secureHandle('kv-remove', async (_e, { key }) => {
  try { kvOrThrow().remove(String(key)); return { success: true }; } catch (e: any) { return { success: false, error: e?.message || String(e) }; }
});
secureHandle('kv-clear', async () => {
  try { kvOrThrow().clear(); return { success: true }; } catch (e: any) { return { success: false, error: e?.message || String(e) }; }
});
secureHandle('kv-import', async (_e, { entries }) => {
  try {
    const store = kvOrThrow();
    if (store.count() > 0) return { success: false, error: 'Depo boş değil; içe aktarma reddedildi' }; // mevcut veri asla ezilmez
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(entries || {})) clean[String(k)] = String(v);
    return { success: true, count: store.setMany(clean) };
  } catch (e: any) { return { success: false, error: e?.message || String(e) }; }
});
secureHandle('kv-info', async () => {
  try { return { success: true, ...kvOrThrow().info() }; } catch (e: any) { return { success: false, error: e?.message || String(e) }; }
});

// ===================== YEDEKLEME =====================
// Veri konumu: Electron `userData` (güncelleme/yeniden kurulumda silinmez). Yedekler ayrı klasörde tutulur.
const backupStore = new BackupStore([]);
const backupSettingsFile = () => path.join(app.getPath('userData'), 'backup-settings.json');
function readBackupSettings(): { secondaryDir?: string } {
  try { return JSON.parse(fs.readFileSync(backupSettingsFile(), 'utf8')); } catch { return {}; }
}
function applyBackupDirs() {
  const primary = process.env.GTU_BACKUP_DIR || path.join(app.getPath('documents'), 'GaziantepliTahaUsta-Yedekler');
  const { secondaryDir } = readBackupSettings();
  backupStore.setDirs([primary, ...(secondaryDir ? [secondaryDir] : [])]);
}

secureHandle('app-info', async () => ({
  version: app.getVersion(),
  userData: app.getPath('userData'),
  backupDir: backupStore.primaryDir(),
  secondaryDir: readBackupSettings().secondaryDir || null,
}));
secureHandle('backup-save', async (_e, { label, json }) => backupStore.save(String(label || 'elle'), String(json || '')));
secureHandle('backup-list', async () => ({ success: true, items: backupStore.list(), dir: backupStore.primaryDir(), secondaryDir: readBackupSettings().secondaryDir || null }));
secureHandle('backup-read', async (_e, { name }) => backupStore.read(String(name || '')));
secureHandle('backup-open-folder', async () => {
  fs.mkdirSync(backupStore.primaryDir(), { recursive: true });
  const err = await shell.openPath(backupStore.primaryDir());
  return { success: !err, error: err || undefined };
});
secureHandle('backup-choose-secondary', async () => {
  const res = await dialog.showOpenDialog(mainWindow!, { title: 'İkinci yedek klasörü (ör. USB bellek / ikinci disk)', properties: ['openDirectory', 'createDirectory'] });
  if (res.canceled || !res.filePaths[0]) return { success: false, error: 'İptal edildi' };
  fs.writeFileSync(backupSettingsFile(), JSON.stringify({ ...readBackupSettings(), secondaryDir: res.filePaths[0] }), 'utf8');
  applyBackupDirs();
  return { success: true, secondaryDir: res.filePaths[0] };
});
secureHandle('backup-clear-secondary', async () => {
  const cur = readBackupSettings();
  delete cur.secondaryDir;
  fs.writeFileSync(backupSettingsFile(), JSON.stringify(cur), 'utf8');
  applyBackupDirs();
  return { success: true };
});

// WINDOWS İŞLETİM SİSTEMİNE BAĞLI USB / SPOOLER YAZICILARI GETİR
secureHandle('get-system-usb-printers', async () => {
  if (mainWindow) {
    try {
      const list = await mainWindow.webContents.getPrintersAsync();
      return list.map(p => ({
        name: p.name,
        displayName: p.displayName || p.name,
        // Electron 45: isDefault/status alanları kaldırıldı; ayrıntı platforma özgü `options` içindedir.
        // Gerçek çevrimiçi durumu işletim sisteminden okunamadığı için 'READY' (durum doğrulanmadı) döndürülür.
        isDefault: String((p.options as Record<string, string> | undefined)?.['is-default'] ?? '').toLowerCase() === 'true',
        status: 'READY',
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
    const buffer = buildTicketBuffer(ticketType, data);
    const success = await sendToNetworkPrinter(ip, port || 9100, buffer);
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// USB / WINDOWS YAZICISINA SESSİZ FİŞ DÖKÜMÜ & WIN32 RAW SPOOLER
secureHandle('print-usb-receipt', async (event, { printerName, rawText, buffer, html, ticketType, data }) => {
  try {
    if (ticketType) {
      const spoolRes = await sendToWindowsSpooler(printerName, buildTicketBuffer(ticketType, data));
      return { success: spoolRes.success, error: spoolRes.error };
    }
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

// ---- Günlük kaydı ve çökme izleme ----
let logger: FileLogger | null = null;
const log = () => (logger ??= new FileLogger(path.join(app.getPath('userData'), 'logs')));
process.on('uncaughtException', (err) => { log().error('Yakalanmamış istisna', err); });
process.on('unhandledRejection', (reason) => { log().error('İşlenmeyen söz reddi', reason); });
app.on('render-process-gone', (_e, _wc, details) => { log().error(`Arayüz süreci kapandı: ${details.reason} (kod ${details.exitCode})`); });
secureHandle('log-tail', async () => ({ success: true, lines: log().tail(80), dir: path.join(app.getPath('userData'), 'logs') }));
secureHandle('log-renderer-error', async (_e, { message }) => { log().error('Arayüz hatası: ' + String(message).slice(0, 2000)); return { success: true }; });

// ---- Tek örnek: iki kasa penceresi aynı yerel veriyi/portu bozmasın ----
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  if (!gotLock) return;
  log().info(`Kasa başlatıldı (sürüm ${app.getVersion()})`);
  applyBackupDirs();
  try {
    kv = new KvStore(path.join(app.getPath('userData'), 'data', 'kasa.db'));
    log().info(`Kalıcı depo açıldı: ${kv.info().path} (${kv.count()} kayıt)`);
  } catch (e) {
    log().error('Kalıcı depo açılamadı (uygulama yalnızca localStorage ile devam edecek)', e);
  }
  startLocalServer(4545);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => { try { kv?.close(); kv = null; } catch {} });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
