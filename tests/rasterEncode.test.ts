import { describe, it, expect } from 'vitest';
import { encodeRaster, monoRows } from '../electron/rasterEncode';
import { buildTicketDoc } from '../electron/receiptBuilder';

const bgra = (w: number, h: number, fn: (x: number, y: number) => number) => {
  const b = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = fn(x, y); const i = (y * w + x) * 4; b[i] = b[i + 1] = b[i + 2] = v; b[i + 3] = 255; }
  return b;
};

describe('grafik baskı kodlayıcı', () => {
  it('siyah/beyaz pikselleri doğru bitlere çevirir (MSB solda)', () => {
    const px = bgra(16, 1, (x) => (x === 0 || x === 9 ? 0 : 255)); // x=0 ve x=9 siyah
    expect(Array.from(monoRows(px, 16, 1))).toEqual([0b10000000, 0b01000000]);
  });
  it('saydam piksel beyaz sayılır; eşik uygulanır', () => {
    const b = new Uint8Array(8 * 4); // hepsi saydam
    expect(Array.from(monoRows(b, 8, 1))).toEqual([0]);
    expect(Array.from(monoRows(bgra(8, 1, () => 200), 8, 1, 165))).toEqual([0]); // açık gri → beyaz
    expect(Array.from(monoRows(bgra(8, 1, () => 100), 8, 1, 165))).toEqual([0xff]); // koyu gri → siyah
  });
  it('GS v 0 komutu doğru başlık ve bantlarla üretilir; kesim isteğe bağlı', () => {
    const w = 576, h = 450;
    const buf = encodeRaster(bgra(w, h, () => 255), w, h, { bandRows: 200, autoCut: true });
    expect(buf.subarray(0, 2)).toEqual(Buffer.from([0x1b, 0x40]));
    const hdr = Buffer.from([0x1d, 0x76, 0x30, 0x00, 72, 0, 200, 0]); // 576/8=72 bayt/satır, 200 satır
    expect(buf.includes(hdr)).toBe(true);
    expect(buf.includes(Buffer.from([0x1d, 0x76, 0x30, 0x00, 72, 0, 50, 0]))).toBe(true); // son bant 50 satır
    expect(buf.length).toBe(2 + 3 * 8 + 72 * h + 3 + 4);
    expect(buf.subarray(buf.length - 4)).toEqual(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
    expect(encodeRaster(bgra(8, 8, () => 255), 8, 8, { autoCut: false }).includes(Buffer.from([0x1d, 0x56]))).toBe(false);
  });
});

describe('grafik fiş HTML (tam Türkçe, gerçek yazı tipi)', () => {
  const data = { ticketTitle: 'OCAK / IZGARA SİPARİŞİ', tableName: 'Şişli Salon / Masa 4', orderTime: '19:42', items: [{ name: 'Çiğ Köfte', quantity: 2, note: 'Acılı, soğansız', price: 99 }], orderNote: 'Öğrenci menüsü' };
  it('Türkçe karakterler olduğu gibi korunur ve yazı tipi sistem fontudur', () => {
    const html = buildTicketDoc('KITCHEN', data).toHtml();
    expect(html).toContain('Çiğ Köfte');
    expect(html).toContain('Acılı, soğansız');
    expect(html).toContain('SİPARİŞİ');
    expect(html).toContain('Öğrenci menüsü');
    expect(html).toMatch(/Segoe UI/);
    expect(html).toContain('width:576px');
  });
  it('mutfak fişinde fiyat yok; 58 mm daha dar', () => {
    const html = buildTicketDoc('KITCHEN', { ...data, paperWidth: 58 }).toHtml();
    expect(html).not.toMatch(/99|TL/);
    expect(html).toContain('width:384px');
  });
  it('HTML özel karakterleri kaçırılır (sipariş notundan kod enjeksiyonu olmaz)', () => {
    const html = buildTicketDoc('KITCHEN', { ...data, orderNote: '<img src=x onerror=alert(1)>' }).toHtml();
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
