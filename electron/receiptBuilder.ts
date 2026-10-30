/**
 * Termal yazıcı fişleri için TEK üretici (ESC/POS). Ağ, USB ve Windows spooler yazıcılarının hepsi bunu kullanır.
 *
 * Tasarım ilkeleri
 *  - Fiyat YALNIZCA adisyon (hesap) fişinde ve kurye tahsilat bilgisinde bulunur. Mutfak/ocak/fırın/bar/iptal
 *    fişleri yalnızca ürün adı, adet, porsiyon ve not içerir.
 *  - Okunaklılık: mutfakta ürün satırları iki kat boyutlu ve kalın, notlar kalın, bölümler çizgiyle ayrılır.
 *  - Genişlik kâğıda göre: 80 mm = 48 sütun, 58 mm = 32 sütun (Font A). Uzun metin kelime sınırında kaydırılır.
 *  - Türkçe karakterler ASCII karşılığına çevrilir (tüm yazıcı kod tablolarında bozulmadan çıkar).
 *  - Hiçbir yerde uydurma varsayılan bilgi (vergi no, telefon, garson adı, sipariş no) basılmaz; olmayan alan atlanır.
 */

const ESC = '\x1B';
const GS = '\x1D';

const FOLD: Record<string, string> = {
  ğ: 'g', Ğ: 'G', ş: 's', Ş: 'S', ı: 'i', İ: 'I', ç: 'c', Ç: 'C', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U',
  '₺': 'TL', '–': '-', '—': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...', '×': 'x', '•': '*',
};

/** Yazıcıya gidecek her metin: Türkçe → ASCII, görünmez/kontrol karakterleri temizlenir. */
export function fold(text: unknown): string {
  if (text === undefined || text === null) return '';
  let out = '';
  for (const ch of String(text)) {
    if (FOLD[ch] !== undefined) out += FOLD[ch];
    else if (ch === '\n' || ch === '\r' || ch === '\t') out += ' ';
    else {
      const c = ch.codePointAt(0)!;
      out += c >= 32 && c < 127 ? ch : c === 160 ? ' ' : '';
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** 1234.5 → "1.234,50" */
export function money(n: unknown): string {
  const v = Number(n) || 0;
  const [i, d] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`;
}

export function wrap(text: string, cols: number): string[] {
  const t = fold(text);
  if (!t) return [];
  const lines: string[] = [];
  let cur = '';
  for (const word of t.split(' ')) {
    let w = word;
    while (w.length > cols) {
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(w.slice(0, cols));
      w = w.slice(cols);
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= cols) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

type Align = 'left' | 'center' | 'right';

class Doc {
  private out = ESC + '@';
  readonly cols: number;
  constructor(paperWidth?: number) {
    this.cols = Number(paperWidth) === 58 ? 32 : 48;
  }
  private size(w: 1 | 2, h: 1 | 2) { this.out += GS + '!' + String.fromCharCode(((w - 1) << 4) | (h - 1)); }
  private align(a: Align) { this.out += ESC + 'a' + String.fromCharCode(a === 'left' ? 0 : a === 'center' ? 1 : 2); }
  private bold(b: boolean) { this.out += ESC + 'E' + String.fromCharCode(b ? 1 : 0); }
  reset() { this.size(1, 1); this.bold(false); this.align('left'); }

  /** Biçimli metin: boyut, kalınlık, hiza. Genişlik çarpanına göre otomatik kaydırır. */
  text(s: string, o: { w?: 1 | 2; h?: 1 | 2; bold?: boolean; align?: Align; indent?: number; prefix?: string } = {}) {
    const w = o.w ?? 1, h = o.h ?? 1;
    const cols = Math.floor(this.cols / w) - (o.indent ?? 0);
    const lines = wrap((o.prefix ?? '') + s, Math.max(8, cols));
    if (!lines.length) return;
    this.size(w, h); this.bold(!!o.bold); this.align(o.align ?? 'left');
    for (const l of lines) this.out += ' '.repeat(o.indent ?? 0) + l + '\n';
    this.reset();
  }
  /** Sol ve sağ sütunlu satır (sağ taraf asla kesilmez; sol taraf sığmazsa kaydırılır). */
  row(left: string, right: string, o: { bold?: boolean; w?: 1 | 2; h?: 1 | 2 } = {}) {
    const w = o.w ?? 1;
    const cols = Math.floor(this.cols / w);
    const r = fold(right);
    const leftLines = wrap(left, Math.max(6, cols - r.length - 1));
    if (!leftLines.length) leftLines.push('');
    this.size(w, o.h ?? 1); this.bold(!!o.bold);
    leftLines.forEach((l, i) => {
      this.out += i === 0 ? l + ' '.repeat(Math.max(1, cols - l.length - r.length)) + r + '\n' : l + '\n';
    });
    this.reset();
  }
  rule(ch: '-' | '=' | '.' = '-') { this.out += (ch === '.' ? '. ' : ch).repeat(ch === '.' ? this.cols / 2 : this.cols).slice(0, this.cols) + '\n'; }
  gap(n = 1) { this.out += '\n'.repeat(n); }
  beep() { this.out += ESC + 'B\x02\x02'; }
  /** Kâğıt besleme ve kesme. autoCut=false ise yalnızca besler. */
  finish(autoCut: boolean | undefined) {
    this.out += ESC + 'd\x05';
    if (autoCut !== false) this.out += GS + 'V\x42\x00';
    return Buffer.from(this.out, 'latin1');
  }
}

/** "Kebap (0.5 Porsiyon)" → { name: "Kebap", portion: "0,5 PORSIYON" } */
function splitPortion(rawName: unknown, portion?: unknown): { name: string; portion: string } {
  let name = fold(rawName);
  let p = '';
  const m = name.match(/\s*\((\d(?:[.,]\d)?)\s*porsiyon\)/i);
  if (m) { p = m[1].replace('.', ','); name = name.replace(m[0], '').trim(); }
  else if (Number(portion) && Number(portion) !== 1) p = String(Number(portion)).replace('.', ',');
  return { name, portion: p ? `${p} PORSIYON` : '' };
}

const qtyText = (q: unknown) => {
  const n = Number(q) || 1;
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
};

function header(d: Doc, title: string, data: any) {
  d.text(title, { w: 1, h: 2, bold: true, align: 'center' });
  if (data.isAdditionalOrder) d.text('*** ILAVE SIPARIS ***', { bold: true, align: 'center' });
  d.rule('=');
}

function metaRow(d: Doc, data: any) {
  const who = fold(data.waiterName);
  const time = fold(data.orderTime);
  if (who || time) d.row(who ? `Garson: ${who}` : '', time);
  if (data.orderNumber !== undefined && data.orderNumber !== null && String(data.orderNumber) !== '') {
    d.text(`Siparis No: ${fold(data.orderNumber)}`);
  }
}

function itemBlock(d: Doc, it: any, o: { bigName: boolean }) {
  const { name, portion } = splitPortion(it.name || it.productName, it.portion);
  const big = o.bigName && d.cols >= 40;
  d.text(`${qtyText(it.quantity)} x ${name}`, { w: big ? 2 : 1, h: 2, bold: true });
  if (portion) d.text(portion, { bold: true, indent: 3 });
  if (it.isGift) d.text('** IKRAM **', { bold: true, indent: 3 });
  if (it.note) d.text(`NOT: ${it.note}`, { bold: true, indent: 3 });
}

// ───────────────────────── MUTFAK / OCAK / FIRIN / BAR FİŞİ (fiyatsız) ─────────────────────────
export function generateKitchenReceipt(data: any): Buffer {
  const d = new Doc(data.paperWidth);
  if (data.beep === true) d.beep();
  const title = fold(String(data.ticketTitle || 'SIPARIS').replace(/^\[ILAVE\]\s*/i, '').replace(/^\[İLAVE\]\s*/i, ''));
  header(d, title, data);

  const table = fold(data.tableName);
  if (table) d.text(table, { w: 2, h: 2, bold: true });
  metaRow(d, data);

  const c = data.customerInfo;
  if (c && (c.name || c.phone)) {
    d.text('PAKET SERVIS', { bold: true });
    if (c.name) d.text(c.name, { bold: true });
  }
  d.rule('-');

  const items: any[] = data.items || [];
  items.forEach((it, idx) => {
    itemBlock(d, it, { bigName: true });
    if (idx < items.length - 1) d.rule('.');
  });
  d.rule('=');

  if (data.orderNote) {
    d.text('SIPARIS NOTU', { bold: true });
    d.text(data.orderNote, { bold: true, h: 2 });
    d.rule('-');
  }
  return d.finish(data.autoCut);
}

// ───────────────────────── İPTAL FİŞİ (fiyatsız) ─────────────────────────
export function generateCancelReceipt(data: any): Buffer {
  const d = new Doc(data.paperWidth);
  if (data.beep === true) d.beep();
  d.text('*** IPTAL ***', { w: 2, h: 2, bold: true, align: 'center' });
  d.rule('=');
  const table = fold(data.tableName);
  if (table) d.text(table, { w: 2, h: 2, bold: true });
  metaRow(d, data);
  d.rule('-');
  const items: any[] = data.items || [];
  items.forEach((it, idx) => {
    const { name, portion } = splitPortion(it.name || it.productName, it.portion);
    d.text(`${qtyText(it.quantity)} x ${name}`, { h: 2, bold: true });
    if (portion) d.text(portion, { bold: true, indent: 3 });
    if (it.reason) d.text(`Neden: ${it.reason}`, { indent: 3 });
    if (idx < items.length - 1) d.rule('.');
  });
  if (data.reason) {
    d.rule('-');
    d.text(`IPTAL NEDENI: ${data.reason}`, { bold: true });
  }
  d.rule('=');
  return d.finish(data.autoCut);
}

// ───────────────────────── ADİSYON / HESAP FİŞİ (fiyatlı) ─────────────────────────
function billCore(d: Doc, data: any) {
  const s = data.settings || {};
  const title = fold(s.title || data.restaurantName);
  if (title) {
    const fits = title.length <= Math.floor(d.cols / 2);
    d.text(title, { w: fits ? 2 : 1, h: 2, bold: true, align: 'center' });
  }
  if (s.subtitle) d.text(s.subtitle, { align: 'center' });
  if (s.address) d.text(s.address, { align: 'center' });
  if (s.phone) d.text(`Tel: ${s.phone}`, { align: 'center' });
  const tax = [s.taxOffice ? fold(s.taxOffice) : '', s.taxNumber ? `VKN: ${fold(s.taxNumber)}` : ''].filter(Boolean).join('  ');
  if (tax) d.text(tax, { align: 'center' });
  if (s.mersisNo) d.text(`MERSIS: ${s.mersisNo}`, { align: 'center' });
  d.rule('=');

  if (s.showTableNumber !== false && data.tableName) d.row('Masa', fold(data.tableName), { bold: true, h: 2 });
  if (s.showWaiterName !== false && data.waiterName) d.row('Garson', fold(data.waiterName));
  if (s.showOrderTime !== false && data.orderTime) d.row('Tarih', fold(data.orderTime));
  if (data.orderNumber !== undefined && data.orderNumber !== null && String(data.orderNumber) !== '') {
    d.row('Adisyon No', fold(data.orderNumber));
  }
  d.rule('-');

  const c = data.customerInfo;
  if (c && (c.name || c.address)) {
    if (c.name) d.row('Musteri', fold(c.name));
    if (c.phone) d.row('Telefon', fold(c.phone));
    if (c.address) d.text(c.address);
    d.rule('-');
  }

  d.row('URUN', 'TUTAR', { bold: true });
  d.rule('-');
  for (const it of (data.items || []) as any[]) {
    const { name, portion } = splitPortion(it.name || it.productName, it.portion);
    const qty = Number(it.quantity) || 1;
    const total = Number(it.totalPrice ?? (Number(it.price) || 0) * qty) || 0;
    d.row(`${qtyText(qty)} x ${name}${portion ? ` (${portion.toLowerCase()})` : ''}`, it.isGift ? 'IKRAM' : money(total));
    if (qty > 1 && !it.isGift) d.text(`${qtyText(qty)} x ${money(it.price)}`, { indent: 3 });
    if (it.note) d.text(`Not: ${it.note}`, { indent: 3 });
  }
  d.rule('-');

  const grand = Number(data.totalAmount) || 0;
  const sub = Number(data.subtotal ?? data.totalAmount) || 0;
  const disc = Number(data.discountAmount) || 0;
  if (disc > 0) {
    d.row('Ara Toplam', money(sub));
    d.row(fold(data.discountReason) || 'Indirim / Ikram', `-${money(disc)}`);
  }
  d.rule('=');
  d.row('TOPLAM', `${money(grand)} TL`, { bold: true, w: 1, h: 2 });
  d.rule('=');

  if (s.showVatDetails !== false && grand > 0) {
    const rate = Number(data.vatRate) || 10;
    const base = Number(data.vatBase) || grand / (1 + rate / 100);
    const vat = Number(data.vatAmount) || grand - base;
    d.row(`KDV %${rate} (dahil)`, money(vat));
    d.row('KDV matrahi', money(base));
    d.rule('-');
  }

  if (s.wifiName) d.text(`Wi-Fi: ${s.wifiName}${s.wifiPassword ? `  Sifre: ${s.wifiPassword}` : ''}`, { align: 'center' });
  if (s.instagram) d.text(`Instagram: ${s.instagram}`, { align: 'center' });
  if (s.footerMessage) d.text(s.footerMessage, { bold: true, align: 'center' });
  d.gap();
  d.text('Bilgi fisidir, mali degeri yoktur.', { align: 'center' });
}

// ───────────────────────── KURYE YOL FİŞİ / PLATFORM PAKET ETİKETİ ─────────────────────────
function courierLike(d: Doc, data: any, showPrices: boolean) {
  const c = data.customerInfo || {};
  const platform = fold(data.platformName || data.tableName);
  const isHandover = !!data.isHandoverTicket;

  d.text(isHandover ? 'PAKET ETIKETI' : 'KURYE FISI', { w: 1, h: 2, bold: true, align: 'center' });
  d.rule('=');

  if (isHandover) {
    const code = fold(data.handoverCode);
    if (code) {
      d.text('TESLIMAT KODU', { bold: true, align: 'center' });
      d.text(`#${code}`, { w: 2, h: 2, bold: true, align: 'center' });
      d.rule('-');
    }
  }
  if (platform) d.row('Kanal', platform, { bold: true });
  if (data.orderNumber) d.row('Siparis No', fold(data.orderNumber));
  if (data.orderTime) d.row('Saat', fold(data.orderTime));
  if (data.courierName) d.row(isHandover ? 'Platform kuryesi' : 'Kurye', fold(data.courierName));
  d.rule('-');

  if (c.name) d.text(c.name, { h: 2, bold: true });
  if (c.phone) d.text(`Tel: ${c.phone}`, { bold: true });
  if (!isHandover && c.address) {
    d.text(c.address, { h: 2 });
    if (c.note && c.note !== 'Not yok') d.text(`Adres/Not: ${c.note}`, { bold: true });
  }
  d.rule('-');

  for (const it of (data.items || []) as any[]) {
    const { name, portion } = splitPortion(it.name || it.productName, it.portion);
    const qty = Number(it.quantity) || 1;
    const label = `${qtyText(qty)} x ${name}${portion ? ` (${portion.toLowerCase()})` : ''}`;
    if (showPrices) d.row(label, money(Number(it.totalPrice ?? (Number(it.price) || 0) * qty)));
    else d.text(label, { bold: true });
    if (it.note) d.text(`Not: ${it.note}`, { indent: 3, bold: true });
  }
  d.rule('=');

  const total = Number(data.totalAmount) || 0;
  const pay = fold(data.paymentMethod).toLowerCase();
  const onDoor = /nakit|kapida|kapi|pos|kart/.test(pay) && !/online/.test(pay);
  if (isHandover) {
    d.text('Paketin uzerine zimbalayin.', { align: 'center' });
  } else if (onDoor) {
    const how = /nakit/.test(pay) ? 'NAKIT' : 'KART/POS';
    d.text(`KAPIDA TAHSILAT: ${how}`, { bold: true, align: 'center' });
    d.text(`${money(total)} TL`, { w: 2, h: 2, bold: true, align: 'center' });
  } else {
    d.text('ONLINE ODENDI - TAHSILAT YOK', { bold: true, align: 'center' });
    if (showPrices && total > 0) d.row('Toplam', `${money(total)} TL`);
  }
}

export function generateBillReceipt(data: any): Buffer {
  const d = new Doc(data.paperWidth);
  // showPrices yalnızca adisyon yazıcısı dışındaki yazıcıda kurye/etiket fişi için kapatılır.
  const showPrices = data.showPrices !== false;
  if (data.isHandoverTicket || data.isCourierTicket) courierLike(d, data, showPrices);
  else billCore(d, data);
  return d.finish(data.autoCut);
}

/** Paket servis / kurye fişi (eski uç noktalar için ayrı veri biçimi). */
export function generateCourierReceipt(data: any): Buffer {
  return generateBillReceipt({
    isCourierTicket: true,
    paperWidth: data.paperWidth,
    autoCut: data.autoCut,
    showPrices: data.showPrices,
    platformName: data.platformName,
    orderNumber: data.orderNumber,
    orderTime: data.time || data.orderTime,
    courierName: data.courierName,
    paymentMethod: data.paymentMethod,
    totalAmount: data.totalAmount,
    customerInfo: {
      name: data.customerName || data.name,
      phone: data.phone || data.customerPhone,
      address: data.address || data.customerAddress,
      note: data.directions || data.addressDirections || data.notes,
    },
    items: (data.items || []).map((i: any) => ({ ...i, note: i.note || i.notes })),
  });
}

// ───────────────────────── Z RAPORU ─────────────────────────
export function generateZReportReceipt(data: any): Buffer {
  const d = new Doc(data.paperWidth);
  const n = (v: unknown) => money(v);
  d.text('GUN SONU Z RAPORU', { w: 1, h: 2, bold: true, align: 'center' });
  if (data.restaurantName) d.text(data.restaurantName, { align: 'center' });
  d.rule('=');
  d.row('Z No', `#${String(data.zNo ?? '').padStart(4, '0')}`);
  d.row('Tarih', fold(data.closedAt));
  d.row('Kapatan', fold(data.closedBy));
  d.row('Adisyon sayisi', String(data.totalOrders ?? 0));
  d.rule('-');

  d.text('TAHSILAT DAGILIMI', { bold: true });
  for (const [type, amount] of Object.entries(data.paymentBreakdown || {})) d.row(fold(type), `${n(amount)} TL`);
  d.rule('-');
  if (Number(data.discountTotal) > 0) d.row('Indirim', `-${n(data.discountTotal)} TL`);
  if (Number(data.giftTotal) > 0) d.row('Ikram', `${n(data.giftTotal)} TL`);
  if (Number(data.cancelTotal) > 0) d.row('Iptal edilen', `${n(data.cancelTotal)} TL`);
  d.row('NET SATIS', `${n(data.netTotal)} TL`, { bold: true, h: 2 });
  d.rule('=');

  d.text('GIDER VE TOPTANCI', { bold: true });
  d.row('Isletme giderleri', `-${n(data.totalExpenses)} TL`);
  d.row('Toptanci alislari', `${n(data.supplierInvoicesTotal)} TL`);
  d.row('Toptanci odemeleri', `-${n(data.supplierPaymentsTotal)} TL`);
  d.rule('-');
  d.row('Nakit satis', `${n(data.paymentBreakdown?.['Nakit'])} TL`);
  d.row('Kasadan cikan gider', `-${n(data.cashExpenses)} TL`);
  d.row('Toptanciya nakit odeme', `-${n(data.supplierCashPayments)} TL`);
  d.row('KASADA NET NAKIT', `${n(data.netCashInRegister)} TL`, { bold: true, h: 2 });
  d.rule('=');

  const sales = Object.entries(data.productSales || {});
  if (sales.length) {
    d.text('URUN SATIS ADETLERI', { bold: true });
    for (const [name, st] of sales as Array<[string, any]>) d.row(`${String(st.quantity)} x ${fold(name)}`, `${n(st.total)} TL`);
    d.rule('=');
  }
  d.text('GUN SONU TAMAMLANDI', { align: 'center' });
  return d.finish(data.autoCut);
}

// ───────────────────────── DONANIM TEST FİŞİ ─────────────────────────
export function generateHardwareTestReceipt(printerName?: string, paperWidth?: number): Buffer {
  const d = new Doc(paperWidth);
  d.text('YAZICI TESTI', { w: 2, h: 2, bold: true, align: 'center' });
  d.rule('=');
  if (printerName) d.row('Yazici', fold(printerName));
  d.row('Tarih', new Date().toLocaleString('tr-TR'));
  d.row('Kagit', d.cols === 32 ? '58 mm' : '80 mm');
  d.rule('-');
  d.text('Bu fis okunuyorsa yazici ve kesici calisiyor.', { align: 'center' });
  return d.finish(true);
}

/** Para çekmecesi tetikleme darbesi (ESC p). */
export function drawerKick(): Buffer {
  return Buffer.from(ESC + 'p\x00\x19\xFA', 'latin1');
}

/** İş türüne göre doğru fişi üretir (KITCHEN | BILL | CANCEL | Z_REPORT | COURIER). */
export function buildTicketBuffer(jobType: string, data: any): Buffer {
  switch (jobType) {
    case 'BILL': return generateBillReceipt(data);
    case 'CANCEL': return generateCancelReceipt(data);
    case 'Z_REPORT': return generateZReportReceipt(data);
    case 'COURIER': return generateCourierReceipt(data);
    default: return generateKitchenReceipt(data);
  }
}
