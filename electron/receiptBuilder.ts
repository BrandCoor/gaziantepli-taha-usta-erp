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

type TextOpts = { w?: 1 | 2; h?: 1 | 2; bold?: boolean; align?: Align; indent?: number; prefix?: string };
type Op =
  | { k: 'text'; s: string; o: TextOpts }
  | { k: 'row'; l: string; r: string; o: { bold?: boolean; w?: 1 | 2; h?: 1 | 2 } }
  | { k: 'rule'; ch: '-' | '=' | '.' }
  | { k: 'gap'; n: number }
  | { k: 'beep' };

/** Görünür metinde kontrol karakterlerini temizler; Türkçe karakterler KORUNUR (grafik baskı için). */
export function clean(text: unknown): string {
  return String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Fiş belgesi: yazıcıdan bağımsız işlem listesi.
 *  - toEscPos(): yazıcının kendi yazı tipiyle METİN baskısı (Türkçe karakterler ASCII karşılığına çevrilir; hızlı yedek mod)
 *  - toHtml()  : GRAFİK baskı için sayfa (gerçek yazı tipi, tam Türkçe); ana süreçte görüntüye çevrilip yazıcıya raster olarak gider
 */
export class Doc {
  private ops: Op[] = [];
  readonly cols: number;
  readonly widthPx: number;
  constructor(paperWidth?: number) {
    const is58 = Number(paperWidth) === 58;
    this.cols = is58 ? 32 : 48;
    this.widthPx = is58 ? 384 : 576; // 203 dpi: 80 mm kâğıtta ~72 mm basılabilir alan, 58 mm'de 48 mm
  }
  text(s: string, o: TextOpts = {}) { if (clean(s) || o.prefix) this.ops.push({ k: 'text', s: clean(s), o }); }
  row(left: string, right: string, o: { bold?: boolean; w?: 1 | 2; h?: 1 | 2 } = {}) { this.ops.push({ k: 'row', l: clean(left), r: clean(right), o }); }
  rule(ch: '-' | '=' | '.' = '-') { this.ops.push({ k: 'rule', ch }); }
  gap(n = 1) { this.ops.push({ k: 'gap', n }); }
  beep() { this.ops.push({ k: 'beep' }); }
  get isEmpty() { return this.ops.length === 0; }
  get hasBeep() { return this.ops.some((o) => o.k === 'beep'); }

  // ---- ESC/POS metin çıktısı ----
  toEscPos(autoCut: boolean | undefined): Buffer {
    let out = ESC + '@';
    const size = (w: 1 | 2, h: 1 | 2) => { out += GS + '!' + String.fromCharCode(((w - 1) << 4) | (h - 1)); };
    const align = (a: Align) => { out += ESC + 'a' + String.fromCharCode(a === 'left' ? 0 : a === 'center' ? 1 : 2); };
    const bold = (b: boolean) => { out += ESC + 'E' + String.fromCharCode(b ? 1 : 0); };
    const reset = () => { size(1, 1); bold(false); align('left'); };
    for (const op of this.ops) {
      if (op.k === 'beep') out += ESC + 'B\x02\x02';
      else if (op.k === 'gap') out += '\n'.repeat(op.n);
      else if (op.k === 'rule') out += (op.ch === '.' ? '. ' : op.ch).repeat(op.ch === '.' ? this.cols / 2 : this.cols).slice(0, this.cols) + '\n';
      else if (op.k === 'text') {
        const o = op.o; const w = o.w ?? 1, h = o.h ?? 1;
        const lines = wrap((o.prefix ?? '') + op.s, Math.max(8, Math.floor(this.cols / w) - (o.indent ?? 0)));
        if (!lines.length) continue;
        size(w, h); bold(!!o.bold); align(o.align ?? 'left');
        for (const l of lines) out += ' '.repeat(o.indent ?? 0) + l + '\n';
        reset();
      } else if (op.k === 'row') {
        const w = op.o.w ?? 1; const cols = Math.floor(this.cols / w); const r = fold(op.r);
        const leftLines = wrap(op.l, Math.max(6, cols - r.length - 1));
        if (!leftLines.length) leftLines.push('');
        size(w, op.o.h ?? 1); bold(!!op.o.bold);
        leftLines.forEach((l, i) => { out += i === 0 ? l + ' '.repeat(Math.max(1, cols - l.length - r.length)) + r + '\n' : l + '\n'; });
        reset();
      }
    }
    out += ESC + 'd\x05';
    if (autoCut !== false) out += GS + 'V\x42\x00';
    return Buffer.from(out, 'latin1');
  }
  /** Geriye dönük uyumluluk: eski adı. */
  finish(autoCut: boolean | undefined) { return this.toEscPos(autoCut); }

  // ---- Grafik (HTML) çıktı ----
  toHtml(): string {
    const W = this.widthPx;
    const base = W >= 576 ? 27 : 22; // px; 203 dpi'de ~3,4 mm harf yüksekliği
    const fs = (w: number, h: number) => Math.round(base * (h === 2 && w === 2 ? 1.9 : h === 2 ? 1.45 : w === 2 ? 1.45 : 1));
    const body: string[] = [];
    for (const op of this.ops) {
      if (op.k === 'gap') body.push(`<div style="height:${14 * op.n}px"></div>`);
      else if (op.k === 'rule') {
        const st = op.ch === '=' ? 'border-top:7px double #000;margin:9px 0' : op.ch === '.' ? 'border-top:2px dotted #000;margin:8px 0' : 'border-top:3px solid #000;margin:8px 0';
        body.push(`<div style="${st}"></div>`);
      } else if (op.k === 'text') {
        const o = op.o; const w = o.w ?? 1, h = o.h ?? 1;
        const pad = o.indent ? `padding-left:${Math.round(o.indent * base * 0.55)}px;` : '';
        body.push(`<div style="font-size:${fs(w, h)}px;font-weight:${o.bold ? 900 : 600};text-align:${o.align ?? 'left'};${pad}margin:2px 0;line-height:1.2">${esc((o.prefix ?? '') + op.s)}</div>`);
      } else if (op.k === 'row') {
        const w = op.o.w ?? 1, h = op.o.h ?? 1; const wt = op.o.bold ? 900 : 600;
        body.push(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;font-size:${fs(w, h)}px;font-weight:${wt};margin:2px 0;line-height:1.2"><span style="flex:1;min-width:0;overflow-wrap:anywhere">${esc(op.l)}</span><span style="white-space:nowrap;text-align:right">${esc(op.r)}</span></div>`);
      }
    }
    return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#fff;color:#000}
body{width:${W}px;padding:6px 8px 18px;box-sizing:border-box;font-family:"Segoe UI","Arial",sans-serif;-webkit-font-smoothing:none}
</style></head><body>${body.join('')}</body></html>`;
  }
}

/** "Kebap (0.5 Porsiyon)" → { name: "Kebap", portion: "0,5 PORSIYON" } */
function splitPortion(rawName: unknown, portion?: unknown): { name: string; portion: string } {
  let name = clean(rawName);
  let p = '';
  const m = name.match(/\s*\((\d(?:[.,]\d)?)\s*porsiyon\)/i);
  if (m) { p = m[1].replace('.', ','); name = name.replace(m[0], '').trim(); }
  else if (Number(portion) && Number(portion) !== 1) p = String(Number(portion)).replace('.', ',');
  return { name, portion: p ? `${p} PORSİYON` : '' };
}

const qtyText = (q: unknown) => {
  const n = Number(q) || 1;
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
};

function header(d: Doc, title: string, data: any) {
  d.text(title, { w: 1, h: 2, bold: true, align: 'center' });
  if (data.isAdditionalOrder) d.text('*** İLAVE SİPARİŞ ***', { bold: true, align: 'center' });
  d.rule('=');
}

function metaRow(d: Doc, data: any) {
  const who = clean(data.waiterName);
  const time = clean(data.orderTime);
  if (who || time) d.row(who ? `Garson: ${who}` : '', time);
  if (data.orderNumber !== undefined && data.orderNumber !== null && String(data.orderNumber) !== '') {
    d.text(`Sipariş No: ${clean(data.orderNumber)}`);
  }
}

function itemBlock(d: Doc, it: any, o: { bigName: boolean }) {
  const { name, portion } = splitPortion(it.name || it.productName, it.portion);
  const big = o.bigName && d.cols >= 40;
  d.text(`${qtyText(it.quantity)} x ${name}`, { w: big ? 2 : 1, h: 2, bold: true });
  if (portion) d.text(portion, { bold: true, indent: 3 });
  if (it.isGift) d.text('** İKRAM **', { bold: true, indent: 3 });
  if (it.note) d.text(`NOT: ${it.note}`, { bold: true, indent: 3 });
}

// ───────────────────────── MUTFAK / OCAK / FIRIN / BAR FİŞİ (fiyatsız) ─────────────────────────
export function kitchenDoc(data: any): Doc {
  const d = new Doc(data.paperWidth);
  if (data.beep === true) d.beep();
  const title = clean(String(data.ticketTitle || 'SİPARİŞ').replace(/^\[ILAVE\]\s*/i, '').replace(/^\[İLAVE\]\s*/i, ''));
  header(d, title, data);

  const table = clean(data.tableName);
  if (table) d.text(table, { w: 2, h: 2, bold: true });
  metaRow(d, data);

  const c = data.customerInfo;
  if (c && (c.name || c.phone)) {
    d.text('PAKET SERVİS', { bold: true });
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
    d.text('SİPARİŞ NOTU', { bold: true });
    d.text(data.orderNote, { bold: true, h: 2 });
    d.rule('-');
  }
  return d;
}

// ───────────────────────── İPTAL FİŞİ (fiyatsız) ─────────────────────────
export function cancelDoc(data: any): Doc {
  const d = new Doc(data.paperWidth);
  if (data.beep === true) d.beep();
  d.text('*** İPTAL ***', { w: 2, h: 2, bold: true, align: 'center' });
  d.rule('=');
  const table = clean(data.tableName);
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
    d.text(`İPTAL NEDENİ: ${data.reason}`, { bold: true });
  }
  d.rule('=');
  return d;
}

// ───────────────────────── ADİSYON / HESAP FİŞİ (fiyatlı) ─────────────────────────
function billCore(d: Doc, data: any) {
  const s = data.settings || {};
  const title = clean(s.title || data.restaurantName);
  if (title) {
    const fits = title.length <= Math.floor(d.cols / 2);
    d.text(title, { w: fits ? 2 : 1, h: 2, bold: true, align: 'center' });
  }
  if (s.subtitle) d.text(s.subtitle, { align: 'center' });
  if (s.address) d.text(s.address, { align: 'center' });
  if (s.phone) d.text(`Tel: ${s.phone}`, { align: 'center' });
  const tax = [s.taxOffice ? clean(s.taxOffice) : '', s.taxNumber ? `VKN: ${clean(s.taxNumber)}` : ''].filter(Boolean).join('  ');
  if (tax) d.text(tax, { align: 'center' });
  if (s.mersisNo) d.text(`MERSIS: ${s.mersisNo}`, { align: 'center' });
  d.rule('=');

  if (s.showTableNumber !== false && data.tableName) d.row('Masa', clean(data.tableName), { bold: true, h: 2 });
  if (s.showWaiterName !== false && data.waiterName) d.row('Garson', clean(data.waiterName));
  if (s.showOrderTime !== false && data.orderTime) d.row('Tarih', clean(data.orderTime));
  if (data.orderNumber !== undefined && data.orderNumber !== null && String(data.orderNumber) !== '') {
    d.row('Adisyon No', clean(data.orderNumber));
  }
  d.rule('-');

  const c = data.customerInfo;
  if (c && (c.name || c.address)) {
    if (c.name) d.row('Müşteri', clean(c.name));
    if (c.phone) d.row('Telefon', clean(c.phone));
    if (c.address) d.text(c.address);
    d.rule('-');
  }

  d.row('ÜRÜN', 'TUTAR', { bold: true });
  d.rule('-');
  for (const it of (data.items || []) as any[]) {
    const { name, portion } = splitPortion(it.name || it.productName, it.portion);
    const qty = Number(it.quantity) || 1;
    const total = Number(it.totalPrice ?? (Number(it.price) || 0) * qty) || 0;
    d.row(`${qtyText(qty)} x ${name}${portion ? ` (${portion.toLowerCase()})` : ''}`, it.isGift ? 'İKRAM' : money(total));
    if (qty > 1 && !it.isGift) d.text(`${qtyText(qty)} x ${money(it.price)}`, { indent: 3 });
    if (it.note) d.text(`Not: ${it.note}`, { indent: 3 });
  }
  d.rule('-');

  const grand = Number(data.totalAmount) || 0;
  const sub = Number(data.subtotal ?? data.totalAmount) || 0;
  const disc = Number(data.discountAmount) || 0;
  if (disc > 0) {
    d.row('Ara Toplam', money(sub));
    d.row(clean(data.discountReason) || 'İndirim / İkram', `-${money(disc)}`);
  }
  d.rule('=');
  d.row('TOPLAM', `${money(grand)} TL`, { bold: true, w: 1, h: 2 });
  d.rule('=');

  if (s.showVatDetails !== false && grand > 0) {
    const rate = Number(data.vatRate) || 10;
    const base = Number(data.vatBase) || grand / (1 + rate / 100);
    const vat = Number(data.vatAmount) || grand - base;
    d.row(`KDV %${rate} (dahil)`, money(vat));
    d.row('KDV matrahı', money(base));
    d.rule('-');
  }

  if (s.wifiName) d.text(`Wi-Fi: ${s.wifiName}${s.wifiPassword ? `  Sifre: ${s.wifiPassword}` : ''}`, { align: 'center' });
  if (s.instagram) d.text(`Instagram: ${s.instagram}`, { align: 'center' });
  if (s.footerMessage) d.text(s.footerMessage, { bold: true, align: 'center' });
  d.gap();
  d.text('Bilgi fişidir, mali değeri yoktur.', { align: 'center' });
}

// ───────────────────────── KURYE YOL FİŞİ / PLATFORM PAKET ETİKETİ ─────────────────────────
function courierLike(d: Doc, data: any, showPrices: boolean) {
  const c = data.customerInfo || {};
  const platform = clean(data.platformName || data.tableName);
  const isHandover = !!data.isHandoverTicket;

  d.text(isHandover ? 'PAKET ETİKETİ' : 'KURYE FİŞİ', { w: 1, h: 2, bold: true, align: 'center' });
  d.rule('=');

  if (isHandover) {
    const code = clean(data.handoverCode);
    if (code) {
      d.text('TESLİMAT KODU', { bold: true, align: 'center' });
      d.text(`#${code}`, { w: 2, h: 2, bold: true, align: 'center' });
      d.rule('-');
    }
  }
  if (platform) d.row('Kanal', platform, { bold: true });
  if (data.orderNumber) d.row('Sipariş No', clean(data.orderNumber));
  if (data.orderTime) d.row('Saat', clean(data.orderTime));
  if (data.courierName) d.row(isHandover ? 'Platform kuryesi' : 'Kurye', clean(data.courierName));
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
  const pay = clean(data.paymentMethod).toLowerCase();
  const onDoor = /nakit|kapida|kapi|pos|kart/.test(pay) && !/online/.test(pay);
  if (isHandover) {
    d.text('Paketin üzerine zımbalayın.', { align: 'center' });
  } else if (onDoor) {
    const how = /nakit/.test(pay) ? 'NAKİT' : 'KART/POS';
    d.text(`KAPIDA TAHSİLAT: ${how}`, { bold: true, align: 'center' });
    d.text(`${money(total)} TL`, { w: 2, h: 2, bold: true, align: 'center' });
  } else {
    d.text('ONLİNE ÖDENDİ – TAHSİLAT YOK', { bold: true, align: 'center' });
    if (showPrices && total > 0) d.row('Toplam', `${money(total)} TL`);
  }
}

export function billDoc(data: any): Doc {
  const d = new Doc(data.paperWidth);
  // showPrices yalnızca adisyon yazıcısı dışındaki yazıcıda kurye/etiket fişi için kapatılır.
  const showPrices = data.showPrices !== false;
  if (data.isHandoverTicket || data.isCourierTicket) courierLike(d, data, showPrices);
  else billCore(d, data);
  return d;
}

/** Paket servis / kurye fişi (eski uç noktalar için ayrı veri biçimi). */
export function courierDoc(data: any): Doc {
  return billDoc({
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
    customerInfo: data.customerInfo || {
      name: data.customerName || data.name,
      phone: data.phone || data.customerPhone,
      address: data.address || data.customerAddress,
      note: data.directions || data.addressDirections || data.notes,
    },
    items: (data.items || []).map((i: any) => ({ ...i, note: i.note || i.notes })),
  });
}

// ───────────────────────── Z RAPORU ─────────────────────────
export function zReportDoc(data: any): Doc {
  const d = new Doc(data.paperWidth);
  const n = (v: unknown) => money(v);
  const neg = (v: unknown) => (Number(v) > 0 ? `-${money(v)}` : money(0)); // "-0,00" görünmesin
  d.text('GÜN SONU Z RAPORU', { w: 1, h: 2, bold: true, align: 'center' });
  if (data.restaurantName) d.text(data.restaurantName, { align: 'center' });
  d.rule('=');
  d.row('Z No', `#${String(data.zNo ?? '').padStart(4, '0')}`);
  d.row('Tarih', clean(data.closedAt));
  d.row('Kapatan', clean(data.closedBy));
  d.row('Adisyon sayısı', String(data.totalOrders ?? 0));
  d.rule('-');

  d.text('TAHSİLAT DAĞILIMI', { bold: true });
  for (const [type, amount] of Object.entries(data.paymentBreakdown || {})) d.row(clean(type), `${n(amount)} TL`);
  d.rule('-');
  if (Number(data.discountTotal) > 0) d.row('İndirim', `${neg(data.discountTotal)} TL`);
  if (Number(data.giftTotal) > 0) d.row('İkram', `${n(data.giftTotal)} TL`);
  if (Number(data.cancelTotal) > 0) d.row('İptal edilen', `${n(data.cancelTotal)} TL`);
  d.row('NET SATIŞ', `${n(data.netTotal)} TL`, { bold: true, h: 2 });
  d.rule('=');

  d.text('GİDER VE TOPTANCI', { bold: true });
  d.row('İşletme giderleri', `${neg(data.totalExpenses)} TL`);
  d.row('Toptancı alışları', `${n(data.supplierInvoicesTotal)} TL`);
  d.row('Toptancı ödemeleri', `${neg(data.supplierPaymentsTotal)} TL`);
  d.rule('-');
  d.row('Nakit satış', `${n(data.paymentBreakdown?.['Nakit'])} TL`);
  d.row('Kasadan çıkan gider', `${neg(data.cashExpenses)} TL`);
  d.row('Toptancıya nakit ödeme', `${neg(data.supplierCashPayments)} TL`);
  d.row('KASADA NET NAKİT', `${n(data.netCashInRegister)} TL`, { bold: true, h: 2 });
  d.rule('=');

  const sales = Object.entries(data.productSales || {});
  if (sales.length) {
    d.text('ÜRÜN SATIŞ ADETLERİ', { bold: true });
    for (const [name, st] of sales as Array<[string, any]>) d.row(`${String(st.quantity)} x ${clean(name)}`, `${n(st.total)} TL`);
    d.rule('=');
  }
  d.text('GÜN SONU TAMAMLANDI', { align: 'center' });
  return d;
}

// ───────────────────────── DONANIM TEST FİŞİ ─────────────────────────
export function hardwareTestDoc(printerName?: string, paperWidth?: number): Doc {
  const d = new Doc(paperWidth);
  d.text('YAZICI TESTİ', { w: 2, h: 2, bold: true, align: 'center' });
  d.rule('=');
  if (printerName) d.row('Yazıcı', clean(printerName));
  d.row('Tarih', new Date().toLocaleString('tr-TR'));
  d.row('Kâğıt', d.cols === 32 ? '58 mm' : '80 mm');
  d.rule('-');
  d.text('Bu fiş okunuyorsa yazıcı ve kesici çalışıyor.', { align: 'center' });
  d.text('Türkçe karakter testi: ÇĞİÖŞÜ çğıöşü', { align: 'center', bold: true });
  return d;
}

/** Para çekmecesi tetikleme darbesi (ESC p). */
export function drawerKick(): Buffer {
  return Buffer.from(ESC + 'p\x00\x19\xFA', 'latin1');
}

/** İş türüne göre fiş BELGESİ (yazıcıdan bağımsız). */
export function buildTicketDoc(jobType: string, data: any): Doc {
  switch (jobType) {
    case 'BILL': return billDoc(data);
    case 'CANCEL': return cancelDoc(data);
    case 'Z_REPORT': return zReportDoc(data);
    case 'COURIER': return courierDoc(data);
    case 'HARDWARE_TEST': return hardwareTestDoc(data?.printerName, data?.paperWidth);
    default: return kitchenDoc(data);
  }
}

// Metin (ESC/POS) üreticileri: grafik baskı kullanılamazsa yedek + testler için.
export const generateKitchenReceipt = (data: any): Buffer => kitchenDoc(data).toEscPos(data.autoCut);
export const generateCancelReceipt = (data: any): Buffer => cancelDoc(data).toEscPos(data.autoCut);
export const generateBillReceipt = (data: any): Buffer => billDoc(data).toEscPos(data.autoCut);
export const generateCourierReceipt = (data: any): Buffer => courierDoc(data).toEscPos(data.autoCut);
export const generateZReportReceipt = (data: any): Buffer => zReportDoc(data).toEscPos(data.autoCut);
export const generateHardwareTestReceipt = (printerName?: string, paperWidth?: number): Buffer => hardwareTestDoc(printerName, paperWidth).toEscPos(true);

/** Geriye dönük: metin (ESC/POS) çıktısı. Yeni kod buildTicketDoc + receiptPrint.buildPrintBuffer kullanır. */
export function buildTicketBuffer(jobType: string, data: any): Buffer {
  return buildTicketDoc(jobType, data).toEscPos(data?.autoCut);
}
