/**
 * Fiş baskı hattı (ana süreç): fiş belgesi → (grafik) gerçek yazı tipiyle görüntü → ESC/POS raster.
 * Grafik baskı başarısız olursa otomatik olarak METİN (ESC/POS) baskısına düşer; fiş asla "sessizce" kaybolmaz.
 */
import { BrowserWindow } from 'electron';
import { buildTicketDoc } from './receiptBuilder';
import { encodeRaster } from './rasterEncode';

interface Captured { bgra: Buffer; width: number; height: number; png: Buffer }

/** HTML'yi yazıcı genişliğinde (piksel) görüntüye çevirir. Gizli pencere kullanır; ekranda görünmez. */
async function captureHtml(html: string, widthPx: number): Promise<Captured> {
  const win = new BrowserWindow({
    show: false, frame: false, width: widthPx, height: 400, useContentSize: true, transparent: false, backgroundColor: '#ffffff',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, backgroundThrottling: false, zoomFactor: 1 },
  });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await win.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(() => 1) : 1');
    const h: number = await win.webContents.executeJavaScript('Math.ceil(document.documentElement.scrollHeight)');
    const height = Math.max(40, Math.min(h, 6000));
    win.setContentSize(widthPx, height);
    await new Promise((r) => setTimeout(r, 120)); // yeniden boyutlandırma çizilsin
    let img = await win.webContents.capturePage({ x: 0, y: 0, width: widthPx, height });
    const sz = img.getSize();
    if (sz.width <= 0 || sz.height <= 0) throw new Error('Boş görüntü alındı');
    if (sz.width !== widthPx) img = img.resize({ width: widthPx, height: Math.round((sz.height * widthPx) / sz.width), quality: 'best' });
    const fin = img.getSize();
    return { bgra: img.toBitmap(), width: fin.width, height: fin.height, png: img.toPNG() };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

export interface PrintBuild { buffer: Buffer; mode: 'GRAPHIC' | 'TEXT'; fallbackReason?: string }

/** Yazıcıya gönderilecek baytları üretir. data.printMode === 'TEXT' ise doğrudan metin baskısı. */
export async function buildPrintBuffer(jobType: string, data: any, log?: (m: string) => void): Promise<PrintBuild> {
  const doc = buildTicketDoc(jobType, data);
  if (data?.printMode === 'TEXT') return { buffer: doc.toEscPos(data.autoCut), mode: 'TEXT' };
  try {
    const cap = await captureHtml(doc.toHtml(), doc.widthPx);
    return { buffer: encodeRaster(cap.bgra, cap.width, cap.height, { autoCut: data.autoCut, beep: data.beep === true }), mode: 'GRAPHIC' };
  } catch (e: any) {
    const reason = e?.message || String(e);
    log?.('Grafik fiş üretilemedi, metin baskısına geçildi: ' + reason);
    return { buffer: doc.toEscPos(data.autoCut), mode: 'TEXT', fallbackReason: reason };
  }
}

/** Ekranda önizleme: yazıcıya gidecek görüntünün birebir PNG'si. */
export async function renderPreview(jobType: string, data: any): Promise<string> {
  const doc = buildTicketDoc(jobType, data);
  const cap = await captureHtml(doc.toHtml(), doc.widthPx);
  return 'data:image/png;base64,' + cap.png.toString('base64');
}
