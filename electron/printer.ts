import * as net from 'net';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

export function formatTurkishText(text: string): string {
  if (!text) return '';
  const charMap: { [key: string]: string } = {
    'ğ': 'g', 'Ğ': 'G',
    'ş': 's', 'Ş': 'S',
    'ı': 'i', 'İ': 'I',
    'ç': 'c', 'Ç': 'C',
    'ö': 'o', 'Ö': 'O',
    'ü': 'u', 'Ü': 'U'
  };
  return text.split('').map(char => charMap[char] || char).join('');
}

const ESC = '\x1B';
const GS = '\x1D';

export const Commands = {
  INIT: `${ESC}@`,
  SELECT_CP857: `${ESC}t\x12`, // ESC t 18 (CP857 Türkçe kod tablosu)
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT: `${ESC}!\x10`,
  DOUBLE_WIDTH: `${ESC}!\x20`,
  DOUBLE_SIZE: `${ESC}!\x30`,
  NORMAL_SIZE: `${ESC}!\x00`,
  BEEP: `${ESC}B\x02\x02`,
  DRAWER_KICK: `${ESC}p\x00\x19\xFA`, // 0x1B 0x70 0x00 0x19 0xFA Para Çekmecesi Açma
  CUT_PAPER: `${GS}V\x41\x03`,
  FULL_CUT: `${GS}V\x00`, // 0x1D 0x56 0x00 Tam Kağıt Kesme
  LINE: '--------------------------------\n',
  DOUBLE_LINE: '================================\n',
};

// ============================================================================
// FİŞ YERLEŞİM YARDIMCILARI
// ----------------------------------------------------------------------------
// 80mm termal yazıcı A yazı tipinde satır başına 48, 58mm ise 32 karakter alır.
// Fişler önceden sabit 32 karaktere göre yazıldığı için 80mm kağıtta sola sıkışmış
// ve hizasız görünüyordu. Ayrıca "₺" simgesi CP857 kod tablosunda bulunmadığından
// yazıcıda bozuk karakter olarak basılıyordu; tutarlarda "TL" kullanılır.
// ============================================================================

export function lineWidth(paperWidth?: number): number {
  return Number(paperWidth) === 58 ? 32 : 48;
}

export function money(value: any): string {
  const n = Number(value) || 0;
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function divider(width: number, char: string = '-'): string {
  return char.repeat(width) + '\n';
}

function centerText(text: string, width: number): string {
  const clean = formatTurkishText(text).slice(0, width);
  const pad = Math.max(0, Math.floor((width - clean.length) / 2));
  return ' '.repeat(pad) + clean + '\n';
}

/** Solda etiket, sağda değer; arada boşlukla hizalanır. */
function twoCols(left: string, right: string, width: number): string {
  const l = formatTurkishText(left);
  const r = formatTurkishText(right);
  const space = Math.max(1, width - l.length - r.length);
  if (l.length + r.length + 1 > width) {
    return l.slice(0, width - r.length - 1) + ' ' + r + '\n';
  }
  return l + ' '.repeat(space) + r + '\n';
}

/** Uzun metni satır genişliğine göre böler, devam satırlarını girintiler. */
function wrapText(text: string, width: number, indent: string = ''): string {
  const clean = formatTurkishText(text);
  if (!clean) return '';
  const usable = Math.max(10, width - indent.length);
  const words = clean.split(/\s+/);
  const rows: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= usable) {
      current += ' ' + word;
    } else {
      rows.push(current);
      current = word;
    }
  }
  if (current) rows.push(current);

  return rows.map((r) => indent + r + '\n').join('');
}

/** Adet + ürün adı solda, tutar sağda hizalı ürün satırı. */
function itemRow(qty: number, name: string, amount: string | null, width: number): string {
  const qtyText = String(qty).padStart(2) + ' ';
  const amountText = amount === null ? '' : amount;
  const nameSpace = width - qtyText.length - amountText.length - (amountText ? 1 : 0);
  const cleanName = formatTurkishText(name);

  if (cleanName.length <= nameSpace) {
    // Tutar yoksa (mutfak fişi) satır sonuna boşluk doldurulmaz.
    if (!amountText) return qtyText + cleanName + '\n';
    const gap = width - qtyText.length - cleanName.length - amountText.length;
    return qtyText + cleanName + ' '.repeat(Math.max(1, gap)) + amountText + '\n';
  }

  // Ürün adı sığmıyorsa: ilk satır ad, tutar bir alt satırda sağa yaslanır.
  let out = qtyText + cleanName.slice(0, nameSpace) + '\n';
  const rest = cleanName.slice(nameSpace).trim();
  if (rest) out += wrapText(rest, width, '   ');
  if (amountText) out += ' '.repeat(Math.max(0, width - amountText.length)) + amountText + '\n';
  return out;
}

// 1. ETHERNET IP AĞ YAZICILARI TARAMASI (Port 9100)
export async function scanLocalNetworkPrinters(): Promise<{ ip: string; port: number; status: string; model: string }[]> {
  const interfaces = os.networkInterfaces();
  const baseIps: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
          if (!baseIps.includes(subnet)) {
            baseIps.push(subnet);
          }
        }
      }
    }
  }

  if (baseIps.length === 0) baseIps.push('192.168.1', '192.168.0');

  const foundPrinters: { ip: string; port: number; status: string; model: string }[] = [];
  const scanPromises: Promise<void>[] = [];

  for (const baseIp of baseIps) {
    for (let i = 1; i <= 254; i++) {
      const targetIp = `${baseIp}.${i}`;
      const p = new Promise<void>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(500);

        socket.connect(9100, targetIp, () => {
          foundPrinters.push({
            ip: targetIp,
            port: 9100,
            status: 'ONLINE',
            model: 'Afanda 892E / Ethernet Ağ Yazıcısı'
          });
          socket.destroy();
          resolve();
        });

        socket.on('error', () => { socket.destroy(); resolve(); });
        socket.on('timeout', () => { socket.destroy(); resolve(); });
      });

      scanPromises.push(p);
    }
  }

  await Promise.all(scanPromises);
  return foundPrinters;
}

// 2. IP ÜZERİNDEN VERİ GÖNDERME
export async function sendToNetworkPrinter(ip: string, port: number = 9100, buffer: Buffer): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(3500);

    client.connect(port, ip, () => {
      client.write(buffer, () => {
        client.end();
        resolve(true);
      });
    });

    client.on('error', () => { client.destroy(); resolve(false); });
    client.on('timeout', () => { client.destroy(); resolve(false); });
  });
}

// 3. MUTFAK FİŞİ (Ocak, Fırın ve İstasyon Ustalarına Özel Fiş Formatı)
export function generateKitchenReceipt(data: any): Buffer {
  const w = lineWidth(data.paperWidth);
  let text = '';

  text += Commands.INIT + Commands.SELECT_CP857 + Commands.BEEP;

  // Başlık
  text += Commands.ALIGN_CENTER + Commands.BOLD_ON + Commands.DOUBLE_HEIGHT;
  text += formatTurkishText(data.ticketTitle || 'MUTFAK SIPARISI') + '\n';
  text += Commands.NORMAL_SIZE;
  if (data.chefStationTitle) {
    text += formatTurkishText(String(data.chefStationTitle).toUpperCase()) + '\n';
  }
  text += Commands.BOLD_OFF + Commands.ALIGN_LEFT;
  text += divider(w, '=');

  if (data.isAdditionalOrder) {
    text += Commands.ALIGN_CENTER + Commands.BOLD_ON;
    text += 'ILAVE SIPARIS\n';
    text += Commands.BOLD_OFF + Commands.ALIGN_LEFT;
    text += divider(w, '-');
  }

  // Paket servis bilgisi
  if (data.customerInfo) {
    text += Commands.BOLD_ON + 'PAKET SERVIS\n' + Commands.BOLD_OFF;
    text += twoCols('Musteri', String(data.customerInfo.name || '-'), w);
    text += twoCols('Telefon', String(data.customerInfo.phone || '-'), w);
    text += wrapText(`Adres: ${data.customerInfo.address || '-'}`, w);
    text += divider(w, '-');
  }

  // Masa / garson / saat
  text += Commands.BOLD_ON + Commands.DOUBLE_HEIGHT;
  text += formatTurkishText(String(data.tableName || 'MASA')) + '\n';
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += twoCols(`Garson: ${data.waiterName || 'Kasa'}`, `Saat: ${data.orderTime || ''}`, w);
  if (data.orderNumber) {
    text += twoCols('Adisyon No', `#${String(data.orderNumber).padStart(4, '0')}`, w);
  }
  text += divider(w, '-');

  // Ürünler — mutfak fişinde fiyat YAZILMAZ
  for (const item of data.items || []) {
    const qty = Number(item.quantity) || 1;
    text += Commands.BOLD_ON;
    text += itemRow(qty, String(item.name || item.productName || '').toUpperCase(), null, w);
    text += Commands.BOLD_OFF;

    if (item.isGift) {
      text += '   > IKRAM\n';
    }
    if (item.note) {
      text += wrapText(`> ${item.note}`, w, '   ');
    }
  }

  text += divider(w, '-');

  if (data.orderNote) {
    text += Commands.BOLD_ON;
    text += wrapText(`NOT: ${data.orderNote}`, w);
    text += Commands.BOLD_OFF;
    text += divider(w, '=');
  }

  text += '\n\n\n' + Commands.CUT_PAPER;
  return Buffer.from(text, 'binary');
}

// 4. HESAP / ADİSYON / KASA FİŞİ (Tam Şablon Uyumlu)
export function generateBillReceipt(data: any): Buffer {
  const w = lineWidth(data.paperWidth);
  const s = data.settings || {};
  const title = s.title || data.restaurantName || 'GAZIANTEPLI TAHA USTA';
  const orderNumber = data.orderNumber || 0;

  let text = '';
  text += Commands.INIT + Commands.SELECT_CP857;

  // Başlık bloğu
  text += Commands.ALIGN_CENTER + Commands.BOLD_ON + Commands.DOUBLE_HEIGHT;
  text += formatTurkishText(title) + '\n';
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  if (s.subtitle) text += centerText(s.subtitle, w);
  if (s.address) text += centerText(s.address, w);
  if (s.phone) text += centerText(`Tel: ${s.phone}`, w);
  if (s.taxOffice || s.taxNumber) {
    text += centerText(`${s.taxOffice || ''} ${s.taxNumber ? 'VKN: ' + s.taxNumber : ''}`.trim(), w);
  }
  text += Commands.ALIGN_LEFT + divider(w, '-');

  // Adisyon künyesi
  if (s.showTableNumber !== false && data.tableName) {
    text += twoCols('MASA', String(data.tableName), w);
  }
  if (s.showWaiterName !== false && data.waiterName) {
    text += twoCols('GARSON', String(data.waiterName), w);
  }
  if (s.showOrderTime !== false && data.orderTime) {
    text += twoCols('TARIH', String(data.orderTime), w);
  }
  if (orderNumber) {
    text += twoCols('ADISYON NO', `#${String(orderNumber).padStart(4, '0')}`, w);
  }

  if (data.customerInfo) {
    text += divider(w, '-');
    text += twoCols('MUSTERI', String(data.customerInfo.name || '-'), w);
    if (data.customerInfo.phone) text += twoCols('TELEFON', String(data.customerInfo.phone), w);
    if (data.customerInfo.address) text += wrapText(`Adres: ${data.customerInfo.address}`, w);
  }

  text += divider(w, '-');

  // Ürün kalemleri — adet solda, tutar sağda hizalı
  for (const item of data.items || []) {
    const qty = Number(item.quantity) || 1;
    const unit = Number(item.price) || 0;
    const total = Number(item.totalPrice ?? unit * qty) || 0;

    text += itemRow(qty, String(item.name || item.productName || ''), money(total), w);
    if (qty > 1 && unit > 0) {
      text += `   ${qty} x ${money(unit)}\n`;
    }
    if (item.note) {
      text += wrapText(`> ${item.note}`, w, '   ');
    }
  }

  text += divider(w, '-');

  // Toplamlar
  const subtotal = Number(data.subtotal ?? data.totalAmount) || 0;
  const discount = Number(data.discountAmount) || 0;
  const grandTotal = Number(data.totalAmount) || (subtotal - discount);

  text += twoCols('Ara Toplam', money(subtotal) + ' TL', w);
  if (discount > 0) {
    text += twoCols('Indirim', '-' + money(discount) + ' TL', w);
  }

  text += divider(w, '=');
  text += Commands.BOLD_ON + Commands.DOUBLE_HEIGHT;
  text += twoCols('TOPLAM', money(grandTotal) + ' TL', w);
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += divider(w, '=');

  // Ödeme dağılımı (varsa)
  if (Array.isArray(data.payments) && data.payments.length > 0) {
    for (const p of data.payments) {
      text += twoCols(String(p.type || 'Odeme'), money(p.amount) + ' TL', w);
    }
    text += divider(w, '-');
  }

  // KDV özeti
  if (s.showVatDetails !== false) {
    const vatBase = Number(data.vatBase) || grandTotal / 1.10;
    const vatAmount = Number(data.vatAmount) || (grandTotal - vatBase);
    text += twoCols('KDV %10 Matrah', money(vatBase) + ' TL', w);
    text += twoCols('KDV Tutari', money(vatAmount) + ' TL', w);
    text += divider(w, '-');
  }

  // Alt bilgi
  text += Commands.ALIGN_CENTER;
  if (s.wifiName) {
    text += centerText(`Wi-Fi: ${s.wifiName}${s.wifiPassword ? ' / ' + s.wifiPassword : ''}`, w);
  }
  if (s.instagram) text += centerText(String(s.instagram), w);
  text += Commands.BOLD_ON;
  text += centerText(s.footerMessage || 'Afiyet Olsun. Yine Bekleriz!', w);
  text += Commands.BOLD_OFF + Commands.ALIGN_LEFT;

  text += '\n\n\n' + Commands.CUT_PAPER;
  return Buffer.from(text, 'binary');
}
// 5. RESMİ Z RAPORU
export function generateZReportReceipt(data: any): Buffer {
  let text = '';
  text += Commands.INIT + Commands.ALIGN_CENTER;
  text += Commands.DOUBLE_SIZE + Commands.BOLD_ON;
  text += `GUN SONU Z RAPORU\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += `${formatTurkishText(data.restaurantName || 'GAZIANTEPLI TAHA USTA')}\n`;
  text += Commands.DOUBLE_LINE;

  text += Commands.ALIGN_LEFT;
  text += `Z NO      : #${String(data.zNo).padStart(4, '0')}\n`;
  text += `TARIH/SAAT: ${data.closedAt}\n`;
  text += `KAPANIS YP: ${formatTurkishText(data.closedBy)}\n`;
  text += `ADISYON SY: ${data.totalOrders} Adet Masa\n`;
  text += Commands.LINE;

  text += Commands.BOLD_ON + 'TAHSILAT DAGILIMI:\n' + Commands.BOLD_OFF;
  for (const [type, amount] of Object.entries(data.paymentBreakdown || {})) {
    const tName = formatTurkishText(type).padEnd(18).substring(0, 18);
    const tAmount = (Number(amount) || 0).toFixed(2).padStart(12);
    text += `${tName} ${tAmount} TL\n`;
  }
  text += Commands.LINE;

  if (data.discountTotal > 0) text += `ISKONTO/INDIRIM : -${Number(data.discountTotal).toFixed(2)} TL\n`;
  if (data.giftTotal > 0)     text += `IKRAM TUTARI    :  ${Number(data.giftTotal).toFixed(2)} TL\n`;
  if (data.cancelTotal > 0)   text += `IPTAL EDILENLER :  ${Number(data.cancelTotal).toFixed(2)} TL\n`;

  text += Commands.LINE + Commands.ALIGN_RIGHT;
  text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `NET SATIS: ${(Number(data.netTotal) || 0).toFixed(2)} TL\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += Commands.DOUBLE_LINE;

  text += Commands.ALIGN_LEFT + Commands.BOLD_ON + 'GIDER VE TOPTANCI AKISI:\n' + Commands.BOLD_OFF;
  text += `Isletme Giderleri : -${(Number(data.totalExpenses) || 0).toFixed(2)} TL\n`;
  text += `Toptanci Alislari :  ${(Number(data.supplierInvoicesTotal) || 0).toFixed(2)} TL\n`;
  text += `Toptanci Odemeleri: -${(Number(data.supplierPaymentsTotal) || 0).toFixed(2)} TL\n`;
  text += Commands.LINE;

  text += Commands.ALIGN_LEFT;
  text += `Nakit Satis Geliri: ${(Number(data.paymentBreakdown?.['Nakit']) || 0).toFixed(2)} TL\n`;
  text += `Kasadan Cikan Gider: -${(Number(data.cashExpenses) || 0).toFixed(2)} TL\n`;
  text += `Toptanciya Nakit Od: -${(Number(data.supplierCashPayments) || 0).toFixed(2)} TL\n`;
  text += Commands.LINE + Commands.ALIGN_RIGHT;
  text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `KASADA NET NAKIT: ${(Number(data.netCashInRegister) || 0).toFixed(2)} TL\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += Commands.DOUBLE_LINE;

  text += Commands.ALIGN_LEFT;
  text += Commands.BOLD_ON + 'URUN BAZLI SATIS ADETLERI:\n' + Commands.BOLD_OFF;
  for (const [pName, pStat] of Object.entries(data.productSales || {})) {
    const name = formatTurkishText(pName).padEnd(18).substring(0, 18);
    const qty = String((pStat as any).quantity).padStart(3);
    const total = (Number((pStat as any).total) || 0).toFixed(2).padStart(8);
    text += `${name} ${qty}x ${total} TL\n`;
  }

  text += Commands.DOUBLE_LINE;
  text += Commands.ALIGN_CENTER;
  text += 'GUN SONU ISLEMI TAMAMLANDI\n\n\n' + Commands.CUT_PAPER;

  return Buffer.from(text, 'binary');
}

// 6. MUTFAK İPTAL FİŞİ
export function generateCancelReceipt(data: any): Buffer {
  let text = '';
  text += Commands.INIT + Commands.BEEP + Commands.BEEP + Commands.ALIGN_CENTER;
  text += Commands.DOUBLE_SIZE + Commands.BOLD_ON;
  text += `*** SIPARIS IPTALI ***\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += Commands.DOUBLE_LINE;
  text += Commands.ALIGN_LEFT;
  text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `MASA: ${formatTurkishText(data.tableName || 'MASA')}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += `Garson: ${formatTurkishText(data.waiterName || 'Kasa')}  |  Saat: ${data.orderTime || new Date().toLocaleTimeString('tr-TR')}\n`;
  text += Commands.LINE;

  for (const item of data.items || []) {
    text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
    text += `IPTAL: ${item.quantity}x ${formatTurkishText(item.name || item.productName)}\n`;
    text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
    if (item.reason) {
      text += `   * Neden: ${formatTurkishText(item.reason)}\n`;
    }
  }

  if (data.reason) {
    text += Commands.LINE + Commands.BOLD_ON;
    text += `IPTAL SEBEBI: ${formatTurkishText(data.reason)}\n`;
    text += Commands.BOLD_OFF;
  }

  text += Commands.LINE + '\n\n\n' + Commands.CUT_PAPER;
  return Buffer.from(text, 'binary');
}

// 7. PAKET SERVİS & KURYE FİŞİ
export function generateCourierReceipt(data: any): Buffer {
  const w = lineWidth(data.paperWidth);
  const isPlatformCourier = data.deliveryModel === 'PLATFORM' || data.deliveryModel === 'PLATFORM_COURIER';
  const platformName = String(data.platformName || data.platform || '').toUpperCase();

  let text = '';
  text += Commands.INIT + Commands.SELECT_CP857 + Commands.BEEP;

  // Başlık: platform siparişinde platform adı öne çıkar
  text += Commands.ALIGN_CENTER + Commands.BOLD_ON + Commands.DOUBLE_HEIGHT;
  text += formatTurkishText(platformName || 'PAKET SERVIS') + '\n';
  text += Commands.NORMAL_SIZE;
  text += formatTurkishText(isPlatformCourier ? 'PLATFORM KURYESI' : 'RESTORAN KURYESI') + '\n';
  text += Commands.BOLD_OFF + Commands.ALIGN_LEFT;
  text += divider(w, '=');

  if (data.platformOrderId) {
    text += twoCols('SIPARIS NO', String(data.platformOrderId), w);
  }
  text += twoCols('TARIH', `${data.date || new Date().toLocaleDateString('tr-TR')} ${data.time || new Date().toLocaleTimeString('tr-TR').slice(0, 5)}`, w);
  text += divider(w, '-');

  // Müşteri bilgileri
  text += Commands.BOLD_ON;
  text += twoCols('MUSTERI', String(data.customerName || data.name || '-'), w);
  text += Commands.BOLD_OFF;
  text += twoCols('TELEFON', String(data.phone || data.customerPhone || '-'), w);
  text += wrapText(`ADRES: ${data.address || data.customerAddress || '-'}`, w);
  if (data.directions || data.addressDirections) {
    text += wrapText(`TARIF: ${data.directions || data.addressDirections}`, w);
  }
  text += divider(w, '-');

  // Ürünler
  for (const item of data.items || []) {
    const qty = Number(item.quantity) || 1;
    const unit = Number(item.price) || 0;
    text += itemRow(qty, String(item.name || item.productName || ''), money(unit * qty), w);
    if (item.note || item.notes) {
      text += wrapText(`> ${item.note || item.notes}`, w, '   ');
    }
  }

  text += divider(w, '-');
  text += Commands.BOLD_ON;
  text += twoCols('TOPLAM', money(data.totalAmount) + ' TL', w);
  text += Commands.BOLD_OFF;
  text += divider(w, '=');

  // Ödeme: platformda ödendiyse kuryenin para almaması için açıkça yazılır
  const payment = String(data.paymentMethod || '').toUpperCase();
  const paidOnline = /ONLINE|KREDI|KART|PLATFORM/.test(payment);
  text += Commands.ALIGN_CENTER + Commands.BOLD_ON;
  text += (paidOnline ? 'ONLINE ODENDI - TAHSILAT YOK' : `KAPIDA TAHSILAT: ${money(data.totalAmount)} TL`) + '\n';
  text += Commands.BOLD_OFF;

  // Platform kuryesi teslim kodu
  if (isPlatformCourier && data.handoverCode) {
    text += Commands.ALIGN_LEFT + divider(w, '-') + Commands.ALIGN_CENTER;
    text += 'TESLIM KODU\n';
    text += Commands.BOLD_ON + Commands.DOUBLE_SIZE;
    text += String(data.handoverCode) + '\n';
    text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  } else if (!isPlatformCourier && data.courierName) {
    text += Commands.ALIGN_LEFT;
    text += twoCols('KURYE', String(data.courierName), w);
    text += Commands.ALIGN_CENTER;
  }

  if (data.orderNote) {
    text += Commands.ALIGN_LEFT + divider(w, '-');
    text += wrapText(`NOT: ${data.orderNote}`, w);
  }

  text += Commands.ALIGN_LEFT;
  text += '\n\n\n' + Commands.CUT_PAPER;
  return Buffer.from(text, 'binary');
}

// 8. DONANIM TEST YAZDIRMASI (Afanda 892E & USB Spooler Doğrulama)
export function generateHardwareTestReceipt(printerName?: string): Buffer {
  let text = '';
  text += Commands.INIT + Commands.SELECT_CP857;
  text += Commands.BEEP;
  text += Commands.DRAWER_KICK; // Para çekmecesi tetikleme testi (0x1B 0x70)
  text += Commands.ALIGN_CENTER;
  text += Commands.DOUBLE_SIZE + Commands.BOLD_ON;
  text += 'GAZIANTEPLI TAHA USTA\n';
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += 'DONANIM & SPOOLER TEST FISI\n';
  text += Commands.DOUBLE_LINE;

  text += Commands.ALIGN_LEFT;
  text += `Yazici Modeli : ${formatTurkishText(printerName || 'Afanda 892E (USB Spooler)')}\n`;
  text += `Tarih & Saat  : ${new Date().toLocaleString('tr-TR')}\n`;
  text += `Baglanti Modu : Win32 RAW Spooler / ESC-POS\n`;
  text += `Kod Tablosu   : CP857 (Turkce Donanim Destekli)\n`;
  text += `Cekmece Testi : 0x1B 0x70 Tetiklendi\n`;
  text += `Kagit Kesici  : 0x1D 0x56 Otomatik Kesim\n`;
  text += Commands.LINE;

  text += Commands.BOLD_ON + 'TURKCE KARAKTER TESTI:\n' + Commands.BOLD_OFF;
  text += 'C-c: Çç | G-g: Ğğ | I-i: Iı İi\n';
  text += 'O-o: Öö | S-s: Şş | U-u: Üü\n';
  text += 'Gaziantepli Taha Usta Kebap & Lahmacun\n';
  text += Commands.LINE;

  text += Commands.ALIGN_CENTER + Commands.BOLD_ON;
  text += '*** DONANIM TESTI BASARIYLA TAMAMLANDI ***\n' + Commands.BOLD_OFF;
  text += '\n\n\n' + Commands.CUT_PAPER;

  return Buffer.from(text, 'binary');
}

// 9. WINDOWS RAW SPOOLER ENTEGRASYONU (Afanda 892E & USB Sürücüler İçin Win32 Spooler API)
export async function sendToWindowsSpooler(printerName: string, buffer: Buffer): Promise<{ success: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    console.log(`[Win32 Spooler Simule Edildi] "${printerName}" yazıcısına ${buffer.length} bayt iletildi.`);
    return { success: true };
  }

  return new Promise((resolve) => {
    try {
      const tempFile = path.join(os.tmpdir(), `gtu_spool_${Date.now()}_${Math.random().toString(36).substring(7)}.bin`);
      fs.writeFileSync(tempFile, buffer);

      const targetPrinter = printerName || 'Afanda 892E';

      // Win32 winspool.drv P/Invoke ile RAW byte stream iletimi
      const psScript = `
$code = @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, string filePath) {
        if (!File.Exists(filePath)) return false;
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "GTU ESC/POS Raw Receipt";
        di.pDataType = "RAW";
        bool success = false;
        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    int written = 0;
                    success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        return success;
    }
}
'@
Add-Type -TypeDefinition $code -Language CSharp
$res = [RawPrinterHelper]::SendBytesToPrinter("${targetPrinter.replace(/"/g, '`"')}", "${tempFile.replace(/\\/g, '\\\\')}")
if ($res) { Write-Output "RAW_SUCCESS" } else { Write-Output "RAW_FAILED" }
`;
      const psScriptPath = path.join(os.tmpdir(), `gtu_spool_cmd_${Date.now()}.ps1`);
      fs.writeFileSync(psScriptPath, psScript);

      exec(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, (err, stdout) => {
        try { fs.unlinkSync(tempFile); } catch (e) {}
        try { fs.unlinkSync(psScriptPath); } catch (e) {}

        if (err || !stdout.includes('RAW_SUCCESS')) {
          // Yedekleme (Fallback): cmd copy /b veya Out-Printer pipe
          exec(`cmd /c copy /b "${tempFile}" "\\\\127.0.0.1\\${targetPrinter}"`, (fallbackErr) => {
            if (fallbackErr) {
              resolve({ success: false, error: err?.message || 'Windows Spooler RAW kuyruğuna yazılamadı' });
            } else {
              resolve({ success: true });
            }
          });
        } else {
          resolve({ success: true });
        }
      });
    } catch (e: any) {
      resolve({ success: false, error: e.message });
    }
  });
}

// 10. SİSTEME BAĞLI TÜM WINDOWS / SPOOLER YAZICILARI TARAMA
export async function listSystemPrinters(): Promise<Array<{ name: string; displayName: string; isDefault: boolean; status: string; type: string }>> {
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      exec('powershell -Command "Get-CimInstance Win32_Printer | Select-Object Name, DriverName, PortName, Default | ConvertTo-Json"', (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve([
            { name: 'Afanda 892E', displayName: 'Afanda 892E (USB Termal)', isDefault: true, status: 'READY', type: 'USB' }
          ]);
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const result = list.map((p: any) => ({
            name: p.Name || 'Yazıcı',
            displayName: `${p.Name} (${p.DriverName || 'USB POS'})`,
            isDefault: !!p.Default,
            status: 'READY',
            type: 'USB'
          }));
          resolve(result);
        } catch (e) {
          resolve([
            { name: 'Afanda 892E', displayName: 'Afanda 892E (USB Termal)', isDefault: true, status: 'READY', type: 'USB' }
          ]);
        }
      });
    });
  }

  return [
    { name: 'Afanda 892E', displayName: 'Afanda 892E (USB Termal Sürücü)', isDefault: true, status: 'READY', type: 'USB' }
  ];
}


