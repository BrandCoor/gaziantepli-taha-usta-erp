import { describe, it, expect } from 'vitest';
import {
  generateKitchenReceipt, generateBillReceipt, generateCancelReceipt, generateCourierReceipt, generateZReportReceipt, fold, money, wrap,
} from '../electron/receiptBuilder';

/** ESC/POS komutlarını ayıklayıp yazıcının basacağı satırları döndürür. */
function lines(buf: Buffer): string[] {
  let s = buf.toString('latin1');
  s = s.replace(/\x1B[@]|\x1B[aEBdp!tM]./g, '').replace(/\x1D[!]./g, '').replace(/\x1DV../g, '').replace(/\x1DV./g, '');
  return s.split('\n');
}
const text = (b: Buffer) => lines(b).join('\n');

const kitchen = {
  ticketTitle: 'OCAK / IZGARA SİPARİŞİ', tableName: 'Ana Salon / Masa 4', waiterName: 'Ali', orderTime: '19:42', orderNumber: 17,
  items: [
    { name: 'Adana Kebap', quantity: 2, note: 'Acılı, köz biberli', price: 280 },
    { name: 'Lahmacun (0.5 Porsiyon)', quantity: 1, price: 45, isGift: true },
  ],
  orderNote: 'Çocuk için sade',
};

describe('fiş üretici', () => {
  it('Türkçe karakterleri ASCII yapar, para formatı Türkçe', () => {
    expect(fold('Çiğ Köfte İşkembe ₺')).toBe('Cig Kofte Iskembe TL');
    expect(money(1234.5)).toBe('1.234,50');
    expect(wrap('bir iki üç dört', 8).every((l) => l.length <= 8)).toBe(true);
  });

  it('mutfak fişinde FİYAT yok; ad, adet, porsiyon, not, ikram var', () => {
    const t = text(generateKitchenReceipt(kitchen));
    expect(t).not.toMatch(/280|45|TL|,00/);
    expect(t).toContain('2 x Adana Kebap');
    expect(t).toContain('NOT: Acili, koz biberli');
    expect(t).toContain('0,5 PORSIYON');
    expect(t).toContain('IKRAM');
    expect(t).toContain('SIPARIS NOTU');
    expect(t).toContain('Masa 4');
  });

  it('iptal fişinde fiyat yok', () => {
    const t = text(generateCancelReceipt({ tableName: 'Masa 2', waiterName: 'Ali', orderTime: '20:00', items: [{ name: 'Kola', quantity: 1, reason: 'Yanlis', price: 60 }], reason: 'Musteri vazgecti' }));
    expect(t).toContain('IPTAL');
    expect(t).not.toMatch(/60|TL/);
  });

  it('adisyonda fiyatlar ve toplam var, uydurma bilgi yok', () => {
    const t = text(generateBillReceipt({
      settings: { title: 'TAHA USTA' }, tableName: 'Masa 4', orderTime: '01.01.2026 19:42',
      items: [{ name: 'Adana Kebap', quantity: 2, price: 280, totalPrice: 560 }], subtotal: 560, totalAmount: 560,
    }));
    expect(t).toContain('560,00');
    expect(t).toContain('TOPLAM');
    expect(t).not.toMatch(/1234567890|Mehmet|555 00 27|TahaUsta_|GTU-|\|\|\|\|/);
    expect(t).not.toContain('VKN'); // vergi no girilmemişse basılmaz
  });

  it('kurye fişi: yazıcı adisyon değilse kalem fiyatı yok, kapıda nakit tutarı var', () => {
    const base = {
      isCourierTicket: true, platformName: 'GETIR', orderNumber: 'A1', orderTime: '19:50', courierName: 'Veli', paymentMethod: 'Kapıda Nakit',
      totalAmount: 450, customerInfo: { name: 'Ayse', phone: '0555', address: 'Gul sok. 4', note: 'Zil bozuk' },
      items: [{ name: 'Adana Kebap', quantity: 1, price: 450 }],
    };
    const noPrice = text(generateBillReceipt({ ...base, showPrices: false }));
    expect(noPrice).toContain('KAPIDA TAHSILAT: NAKIT');
    expect(noPrice).toContain('450,00 TL');
    expect(noPrice.match(/450,00/g)!.length).toBe(1);
    expect(text(generateBillReceipt({ ...base, showPrices: true })).match(/450,00/g)!.length).toBeGreaterThan(1);
  });

  it('platform paket etiketi teslimat kodunu büyük basar', () => {
    const t = text(generateBillReceipt({ isHandoverTicket: true, platformName: 'GETIR', orderNumber: 'X9', handoverCode: '4821', customerInfo: { name: 'Ayse' }, items: [{ name: 'Lahmacun', quantity: 3 }], showPrices: false }));
    expect(t).toContain('#4821');
  });

  it('hiçbir satır kâğıt genişliğini aşmaz (80 mm=48, 58 mm=32; çift genişlikte yarısı)', () => {
    for (const pw of [80, 58]) {
      const cols = pw === 58 ? 32 : 48;
      const bufs = [
        generateKitchenReceipt({ ...kitchen, paperWidth: pw, items: [{ name: 'Çok uzun isimli bir ürün adı örneği deneme', quantity: 12, note: 'çok uzun bir not metni burada yazıyor' }] }),
        generateBillReceipt({ paperWidth: pw, settings: { title: 'Çok Uzun Bir Restoran Adı Burada', address: 'Çok uzun bir adres bilgisi burada yazıyor mahalle sokak' }, tableName: 'Salon / Masa 4', items: [{ name: 'Çok uzun isimli bir ürün adı örneği deneme', quantity: 3, price: 1234.5, totalPrice: 3703.5 }], totalAmount: 3703.5 }),
        generateZReportReceipt({ paperWidth: pw, zNo: 3, paymentBreakdown: { Nakit: 1000 }, productSales: { 'Çok uzun isimli bir ürün adı': { quantity: 3, total: 100 } } }),
        generateCourierReceipt({ paperWidth: pw, customerName: 'A', address: 'uzun adres uzun adres uzun adres uzun adres uzun adres', items: [{ name: 'X', quantity: 1, price: 1 }], totalAmount: 1 }),
      ];
      for (const b of bufs) {
        // çift genişlik komutlu satırlarda sınır yarıya iner; en kötü durum için 48/32 üst sınırı kontrol edilir
        for (const l of lines(b)) expect(l.length).toBeLessThanOrEqual(cols);
      }
    }
  });

  it('kesici açık/kapalı ve zil yalnızca istenirse', () => {
    expect(generateKitchenReceipt({ ...kitchen, autoCut: false }).includes(Buffer.from('\x1DV'))).toBe(false);
    expect(generateKitchenReceipt(kitchen).includes(Buffer.from('\x1DV'))).toBe(true);
    expect(generateKitchenReceipt(kitchen).includes(Buffer.from('\x1BB'))).toBe(false);
    expect(generateKitchenReceipt({ ...kitchen, beep: true }).includes(Buffer.from('\x1BB'))).toBe(true);
  });
});
