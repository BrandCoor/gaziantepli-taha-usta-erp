import * as net from 'net';
import * as os from 'os';

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
  CUT_PAPER: `${GS}V\x41\x03`,
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

// 3. MUTFAK FİŞİ (CALLER ID MÜŞTERİ ADRES VE TELEFONUYLA)
export function generateKitchenReceipt(data: any): Buffer {
  let text = '';
  text += Commands.INIT + Commands.BEEP + Commands.ALIGN_CENTER;
  text += Commands.DOUBLE_SIZE + Commands.BOLD_ON;
  text += `${formatTurkishText(data.ticketTitle || 'MUTFAK FISI')}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;

  if (data.customerInfo) {
    text += Commands.DOUBLE_LINE;
    text += Commands.ALIGN_CENTER;
    text += Commands.BOLD_ON + '*** PAKET SERVIS / TESLIMAT ***\n' + Commands.BOLD_OFF;
    text += Commands.ALIGN_LEFT;
    text += Commands.BOLD_ON + `MUSTERI: ${formatTurkishText(data.customerInfo.name)}\n` + Commands.BOLD_OFF;
    text += `TELEFON: ${formatTurkishText(data.customerInfo.phone)}\n`;
    text += Commands.BOLD_ON + `ADRES  : ${formatTurkishText(data.customerInfo.address)}\n` + Commands.BOLD_OFF;
    text += Commands.DOUBLE_LINE;
  } else {
    text += Commands.LINE;
  }

  text += Commands.ALIGN_LEFT;
  text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `MASA: ${formatTurkishText(data.tableName)}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += `Garson: ${formatTurkishText(data.waiterName || 'Kasa')}  |  Saat: ${data.orderTime}\n`;
  text += Commands.LINE;

  for (const item of data.items || []) {
    text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
    text += `${item.quantity} x ${formatTurkishText(item.name || item.productName)}\n`;
    text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;

    if (item.note) {
      text += `   * NOT: ${formatTurkishText(item.note)}\n`;
    }
  }

  if (data.orderNote) {
    text += Commands.LINE + Commands.BOLD_ON;
    text += `MASA NOTU: ${formatTurkishText(data.orderNote)}\n`;
    text += Commands.BOLD_OFF;
  }

  text += Commands.LINE + '\n\n\n' + Commands.CUT_PAPER;
  return Buffer.from(text, 'binary');
}

// 4. HESAP FİŞİ
export function generateBillReceipt(data: any): Buffer {
  let text = '';
  text += Commands.INIT + Commands.ALIGN_CENTER;
  text += Commands.DOUBLE_SIZE + Commands.BOLD_ON;
  text += `${formatTurkishText(data.restaurantName || 'GAZIANTEPLI TAHA USTA')}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += `Masa: ${formatTurkishText(data.tableName)}  |  Saat: ${data.orderTime}\n`;

  if (data.customerInfo) {
    text += Commands.LINE + Commands.ALIGN_LEFT;
    text += `Musteri: ${formatTurkishText(data.customerInfo.name)} (${formatTurkishText(data.customerInfo.phone)})\n`;
    text += `Adres  : ${formatTurkishText(data.customerInfo.address)}\n`;
  }

  text += Commands.LINE + Commands.ALIGN_LEFT;

  for (const item of data.items || []) {
    const name = formatTurkishText(item.name || item.productName).padEnd(18).substring(0, 18);
    const qty = String(item.quantity).padStart(2);
    const total = (Number(item.totalPrice || item.price * item.quantity) || 0).toFixed(2).padStart(8);
    text += `${name} ${qty}x ${total} TL\n`;
  }

  text += Commands.LINE + Commands.ALIGN_RIGHT;
  text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `TOPLAM: ${(Number(data.totalAmount) || 0).toFixed(2)} TL\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += Commands.ALIGN_CENTER + Commands.LINE;
  text += 'AFIYET OLSUN - YINE BEKLERIZ\n\n\n' + Commands.CUT_PAPER;
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
