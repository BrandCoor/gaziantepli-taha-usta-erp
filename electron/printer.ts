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
  let text = '';
  text += Commands.INIT + Commands.BEEP + Commands.ALIGN_CENTER;
  text += Commands.DOUBLE_SIZE + Commands.BOLD_ON;
  text += `${formatTurkishText(data.ticketTitle || 'MUTFAK SIPARISI')}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_ON;
  text += `>>> ${formatTurkishText(data.chefStationTitle || 'USTA')} DIKKATINE <<<\n`;
  text += Commands.BOLD_OFF;

  if (data.customerInfo) {
    text += Commands.DOUBLE_LINE;
    text += Commands.ALIGN_CENTER;
    text += Commands.BOLD_ON + '*** PAKET SERVIS / KURYE SIPARISI ***\n' + Commands.BOLD_OFF;
    text += Commands.ALIGN_LEFT;
    text += Commands.BOLD_ON + `MUSTERI: ${formatTurkishText(data.customerInfo.name)}\n` + Commands.BOLD_OFF;
    text += `TELEFON: ${formatTurkishText(data.customerInfo.phone)}\n`;
    text += Commands.BOLD_ON + `ADRES  : ${formatTurkishText(data.customerInfo.address)}\n` + Commands.BOLD_OFF;
    text += Commands.DOUBLE_LINE;
  } else {
    text += Commands.DOUBLE_LINE;
  }

  text += Commands.ALIGN_LEFT;
  text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `MASA: ${formatTurkishText(data.tableName)}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += `Garson: ${formatTurkishText(data.waiterName || 'Kasa')}  |  Saat: ${data.orderTime}\n`;
  if (data.orderNumber) {
    text += `Siparis No: #GTU-${new Date().getFullYear()}-${String(data.orderNumber).padStart(4, '0')}\n`;
  }
  text += Commands.LINE;

  text += Commands.BOLD_ON + 'HAZIRLANACAK / PISIRILECEK URUNLER:\n' + Commands.BOLD_OFF;

  for (const item of data.items || []) {
    text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
    text += `>> ${item.quantity} x ${formatTurkishText(item.name || item.productName)}\n`;
    text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;

    text += `   [YAPILACAK URUN: ${formatTurkishText(item.chefStation || data.chefStationTitle || 'USTA')}]\n`;

    if (item.isGift) {
      text += `   *** [IKRAM URUN - HESAPSIZ] ***\n`;
    }

    if (item.note) {
      text += `   * USTA NOTU: ${formatTurkishText(item.note)}\n`;
    }
    text += '--------------------------------\n';
  }

  if (data.orderNote) {
    text += Commands.BOLD_ON;
    text += `MASA NOTU: ${formatTurkishText(data.orderNote)}\n`;
    text += Commands.BOLD_OFF;
    text += Commands.LINE;
  }

  text += '\n\n\n' + Commands.CUT_PAPER;
  return Buffer.from(text, 'binary');
}

// 4. HESAP / ADİSYON / KASA FİŞİ (Tam Şablon Uyumlu)
export function generateBillReceipt(data: any): Buffer {
  const s = data.settings || {};
  const title = s.title || data.restaurantName || 'GAZIANTEPLI TAHA USTA';
  const subtitle = s.subtitle || 'Kebap & Lahmacun Salonu';
  const address = s.address || 'Sehitkamil / Gaziantep';
  const phone = s.phone || '0 (342) 555 00 27';
  const taxNumber = s.taxNumber || '1234567890';
  const taxOffice = s.taxOffice || 'Sehitkamil V.D.';
  const mersisNo = s.mersisNo || '012345678900001';
  const wifiName = s.wifiName || 'TahaUsta_Misafir';
  const wifiPassword = s.wifiPassword || '';
  const instagram = s.instagram || '@gazianteplitahausta';
  const footerMessage = s.footerMessage || 'Afiyet Olsun. Yine Bekleriz!';
  const orderNumber = data.orderNumber || 841;
  const orderNoStr = `#GTU-${new Date().getFullYear()}-${String(orderNumber).padStart(4, '0')}`;

  let text = '';
  text += Commands.INIT + Commands.ALIGN_CENTER;

  if (s.printLogo !== false) {
    text += Commands.BOLD_ON + '[ TU ]\n' + Commands.BOLD_OFF;
  }

  text += Commands.DOUBLE_SIZE + Commands.BOLD_ON;
  text += `${formatTurkishText(title)}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += `${formatTurkishText(subtitle)}\n`;
  text += `${formatTurkishText(address)}\n`;
  text += `Tel: ${formatTurkishText(phone)}\n`;
  text += `${formatTurkishText(taxOffice)} . VKN: ${taxNumber}`;
  if (mersisNo) {
    text += ` . MERSIS: ${mersisNo}`;
  }
  text += '\n' + Commands.LINE;

  // Masa, Garson, Tarih ve Adisyon No
  text += Commands.ALIGN_LEFT;
  if (s.showTableNumber !== false) {
    text += Commands.BOLD_ON + `MASA:        ${formatTurkishText(data.tableName)}\n` + Commands.BOLD_OFF;
  }
  if (s.showWaiterName !== false) {
    text += `GARSON:      ${formatTurkishText(data.waiterName || 'Mehmet Usta')}\n`;
  }
  if (s.showOrderTime !== false) {
    text += `TARIH & SAAT:${data.orderTime}\n`;
  }
  text += `ADISYON NO:  ${orderNoStr}\n`;
  text += Commands.LINE;

  // Paket Servis Müşteri Bilgisi Varsa
  if (data.customerInfo) {
    text += `MUSTERI: ${formatTurkishText(data.customerInfo.name)} (${formatTurkishText(data.customerInfo.phone)})\n`;
    text += `ADRES  : ${formatTurkishText(data.customerInfo.address)}\n`;
    text += Commands.LINE;
  }

  // Ürün Kalemleri Tablosu
  text += `URUN ACIKLAMASI                 TUTAR\n`;
  text += '--------------------------------\n';

  for (const item of data.items || []) {
    const itemName = formatTurkishText(item.name || item.productName);
    const qty = Number(item.quantity) || 1;
    const itemPrice = Number(item.price) || 0;
    const itemTotal = Number(item.totalPrice || itemPrice * qty) || 0;

    const lineLeft = `${qty}x ${itemName}`.substring(0, 22).padEnd(22);
    const lineRight = `₺${itemTotal.toFixed(2)}`.padStart(10);
    text += `${lineLeft}${lineRight}\n`;

    if (item.note) {
      text += `  * ${formatTurkishText(item.note)}\n`;
    }
    if (qty > 1) {
      text += `  ${qty} x ₺${itemPrice.toFixed(2)}\n`;
    }
  }

  text += Commands.LINE;

  // Ara Toplam, İskonto ve Genel Toplam
  const subtotal = Number(data.subtotal || data.totalAmount) || 0;
  const discount = Number(data.discountAmount) || 0;
  const grandTotal = Number(data.totalAmount) || (subtotal - discount);

  text += `Ara Toplam:`.padEnd(20) + `₺${subtotal.toFixed(2)}`.padStart(12) + '\n';
  if (discount > 0) {
    text += `Ikram & Indirim:`.padEnd(20) + `-₺${discount.toFixed(2)}`.padStart(12) + '\n';
  }

  text += Commands.DOUBLE_LINE;
  text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `GENEL TOPLAM:`.padEnd(16) + `₺${grandTotal.toFixed(2)}`.padStart(16) + '\n';
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += Commands.DOUBLE_LINE;

  // KDV Tablosu
  if (s.showVatDetails !== false) {
    const vatBase = Number(data.vatBase) || (grandTotal / 1.10);
    const vatAmount = Number(data.vatAmount) || (grandTotal - vatBase);
    text += `KDV ORANI       MATRAH    KDV TUTARI\n`;
    text += `%10 Yiyecek   ₺${vatBase.toFixed(2).padStart(8)}  ₺${vatAmount.toFixed(2).padStart(8)}\n`;
    text += Commands.LINE;
  }

  // Wi-Fi & Sosyal Medya
  if (wifiName || instagram) {
    text += Commands.ALIGN_CENTER;
    if (wifiName) {
      text += `Wi-Fi: ${formatTurkishText(wifiName)} | Sifre: ${formatTurkishText(wifiPassword)}\n`;
    }
    if (instagram) {
      text += `Instagram: ${formatTurkishText(instagram)}\n`;
    }
    text += Commands.LINE;
  }

  // Kapanış Mesajı
  text += Commands.ALIGN_CENTER + Commands.BOLD_ON;
  text += `${formatTurkishText(footerMessage)}\n` + Commands.BOLD_OFF;

  // Barkod Simülasyonu
  if (s.showBarcode !== false) {
    text += `\n||||| |||| |||||| |||||\n`;
    text += `GTU-${new Date().getFullYear()}-${String(orderNumber).padStart(4, '0')}-KASA\n`;
  }

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
  let text = '';
  text += Commands.INIT + Commands.BEEP + Commands.ALIGN_CENTER;
  text += Commands.DOUBLE_SIZE + Commands.BOLD_ON;
  text += `GAZIANTEPLI TAHA USTA\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += `*** PAKET SERVIS / KURYE FISI ***\n`;
  text += Commands.DOUBLE_LINE;

  text += Commands.ALIGN_LEFT;
  text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `MUSTERI: ${formatTurkishText(data.customerName || data.name || 'Isimsiz')}\n`;
  text += `TEL: ${data.phone || data.customerPhone || '-'}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += Commands.LINE;

  text += Commands.BOLD_ON + `ADRES:\n` + Commands.BOLD_OFF;
  text += `${formatTurkishText(data.address || data.customerAddress || 'Adres belirtilmedi')}\n`;
  if (data.directions || data.addressDirections) {
    text += Commands.BOLD_ON + `ADRES TARIFI: ` + Commands.BOLD_OFF;
    text += `${formatTurkishText(data.directions || data.addressDirections)}\n`;
  }
  if (data.notes) {
    text += Commands.BOLD_ON + `NOT: ` + Commands.BOLD_OFF;
    text += `${formatTurkishText(data.notes)}\n`;
  }
  text += Commands.LINE;

  text += `Tarih: ${data.date || new Date().toLocaleDateString('tr-TR')}  Saat: ${data.time || new Date().toLocaleTimeString('tr-TR')}\n`;
  text += `Odeme: ${formatTurkishText(data.paymentMethod || 'Kapi Odeme')}  |  Kurye: ${formatTurkishText(data.courierName || 'Restoran')}\n`;
  text += Commands.DOUBLE_LINE;

  text += Commands.BOLD_ON + `SIPARIS DETAYI:\n` + Commands.BOLD_OFF;
  for (const item of data.items || []) {
    const qty = String(item.quantity).padStart(2);
    const name = formatTurkishText(item.name || item.productName || '').padEnd(20).substring(0, 20);
    const price = (Number(item.price * item.quantity) || 0).toFixed(2).padStart(8);
    text += `${qty}x ${name} ${price} TL\n`;
    if (item.notes) {
      text += `   * ${formatTurkishText(item.notes)}\n`;
    }
  }
  text += Commands.LINE;
  text += Commands.ALIGN_RIGHT + Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `TOPLAM TUTAR: ${(Number(data.totalAmount) || 0).toFixed(2)} TL\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += Commands.DOUBLE_LINE;
  text += Commands.ALIGN_CENTER;
  text += `AFIYET OLSUN!\n\n\n` + Commands.CUT_PAPER;

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


