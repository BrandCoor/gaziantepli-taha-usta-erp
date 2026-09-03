import * as net from 'net';

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
};

// SADE & NET MUTFAK FİŞİ (AŞÇI DOSTU)
export function generateKitchenReceipt(data: any): Buffer {
  let text = '';
  text += Commands.INIT;
  text += Commands.BEEP;
  text += Commands.ALIGN_CENTER;
  text += Commands.DOUBLE_SIZE + Commands.BOLD_ON;
  text += `${formatTurkishText(data.ticketTitle || 'MUTFAK FISI')}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += Commands.LINE;

  text += Commands.ALIGN_LEFT;
  text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `MASA: ${formatTurkishText(data.tableName)}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += `Garson: ${formatTurkishText(data.waiterName || 'Garson')}  |  Saat: ${data.orderTime}\n`;
  text += Commands.LINE;

  for (const item of data.items) {
    text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
    text += `${item.quantity} x ${formatTurkishText(item.name || item.productName)}\n`;
    text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;

    if (item.note) {
      text += `   * NOT: ${formatTurkishText(item.note)}\n`;
    }
  }

  if (data.orderNote) {
    text += Commands.LINE;
    text += Commands.BOLD_ON;
    text += `MASA NOTU: ${formatTurkishText(data.orderNote)}\n`;
    text += Commands.BOLD_OFF;
  }

  text += Commands.LINE;
  text += '\n\n\n';
  text += Commands.CUT_PAPER;

  return Buffer.from(text, 'binary');
}

// SADE & NET HESAP / ADİSYON FİŞİ
export function generateBillReceipt(data: any): Buffer {
  let text = '';
  text += Commands.INIT;
  text += Commands.ALIGN_CENTER;
  text += Commands.DOUBLE_SIZE + Commands.BOLD_ON;
  text += `${formatTurkishText(data.restaurantName || 'GAZIANTEPLI TAHA USTA')}\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;
  text += `Masa: ${formatTurkishText(data.tableName)}  |  Saat: ${data.orderTime}\n`;
  text += Commands.LINE;

  text += Commands.ALIGN_LEFT;
  for (const item of data.items) {
    const name = formatTurkishText(item.name || item.productName).padEnd(18).substring(0, 18);
    const qty = String(item.quantity).padStart(2);
    const total = (Number(item.totalPrice || item.price * item.quantity) || 0).toFixed(2).padStart(8);
    text += `${name} ${qty}x ${total} TL\n`;
  }

  text += Commands.LINE;
  text += Commands.ALIGN_RIGHT;
  text += Commands.DOUBLE_HEIGHT + Commands.BOLD_ON;
  text += `TOPLAM: ${(Number(data.totalAmount) || 0).toFixed(2)} TL\n`;
  text += Commands.NORMAL_SIZE + Commands.BOLD_OFF;

  text += Commands.ALIGN_CENTER;
  text += Commands.LINE;
  text += 'AFIYET OLSUN - YINE BEKLERIZ\n';
  text += '\n\n\n';
  text += Commands.CUT_PAPER;

  return Buffer.from(text, 'binary');
}
