import { describe, it, expect, beforeEach } from 'vitest';
import { freshServices, item } from './helpers/browserStub';
import { getBusinessDate } from '../src/utils/businessDate';

const sum = (o: Record<string, number>) => Math.round(Object.values(o).reduce((a, b) => a + b, 0) * 100) / 100;

describe('mali analiz hesapları tutarlılığı', () => {
  let rds: any;
  beforeEach(async () => { ({ rds } = await freshServices()); });

  const pay = (idx: number, items: any[], payments: Array<[string, number]>) => {
    const t = rds.getTables()[idx];
    rds.updateTableOrder(t.id, items);
    const r = rds.completeTablePayment(t.id, 'x', payments.map(([type, amount], i) => ({ id: `p${idx}${i}`, type, amount, time: '1' })));
    expect(r.success).toBe(true);
  };

  it('iptal edilen adisyon cirodan, adetten ve ürün satışından DÜŞER; iptal tutarı bir kez sayılır', () => {
    pay(0, [item('Kebap', 100, 2)], [['Nakit', 200]]);
    const t = rds.getTables()[1];
    rds.updateTableOrder(t.id, [item('Lahmacun', 50, 3)]);
    rds.cancelTableOrder(t.id, 'musteri vazgecti');

    const x = rds.getCurrentXReport();
    expect(x.grossTotal).toBe(200);
    expect(x.totalOrders).toBe(1);
    expect(x.productSales['Lahmacun']).toBeUndefined();
    const f = rds.getFilteredReport({});
    expect(f.grossTotal).toBe(200);
    expect(f.totalOrders).toBe(1);
    expect(f.cancelTotal).toBe(150); // 3 x 50, çift sayılmaz
    expect(x.cancelTotal).toBe(150);
  });

  it('net ciro = ödeme dağılımının toplamı (indirim ve ikram ödemesi düşülür)', () => {
    pay(0, [item('Kebap', 100, 3)], [['Nakit', 200], ['İndirim (İskonto)', 50], ['İkram (Tutar Düş)', 50]]);
    pay(1, [item('Ayran', 20, 5)], [['Kredi Kartı', 60], ['Cari (Ali)', 40]]);
    for (const r of [rds.getCurrentXReport(), rds.getFilteredReport({})]) {
      expect(r.grossTotal).toBe(400);
      expect(r.discountTotal).toBe(50);
      expect(r.netTotal).toBe(300);
      expect(sum(r.paymentBreakdown)).toBe(r.netTotal);
      expect(r.avgOrderAmount).toBe(150);
      expect(r.vatBreakdown[0].baseAmount + r.vatBreakdown[0].vatAmount).toBeCloseTo(300, 2);
    }
    expect(rds.getFilteredReport({}).giftTotal).toBe(50);
  });

  it('bölüm/garson/saat dağılımlarının toplamı net ciroya eşit', () => {
    pay(0, [item('Kebap', 100, 3)], [['Nakit', 250], ['İndirim (İskonto)', 50]]);
    pay(1, [item('Ayran', 20, 5)], [['Nakit', 100]]);
    const f = rds.getFilteredReport({});
    const tot = (m: any) => Math.round(Object.values(m).reduce((a: number, v: any) => a + v.total, 0) * 100) / 100;
    expect(tot(f.sectionBreakdown)).toBe(f.netTotal);
    expect(tot(f.waiterBreakdown)).toBe(f.netTotal);
    expect(tot(f.hourlySales)).toBe(f.netTotal);
    const x = rds.getCurrentXReport();
    expect(sum(x.sectionBreakdown)).toBe(x.netTotal);
  });

  it('ikram kalem adet sayılır ama ciroya girmez; ürün/kategori toplamı brüte eşit', () => {
    pay(0, [item('Kebap', 100, 2), item('Baklava', 80, 1, { isGift: true })], [['Nakit', 200]]);
    for (const r of [rds.getCurrentXReport(), rds.getFilteredReport({})]) {
      expect(r.productSales['Baklava'].total).toBe(0);
      expect(r.productSales['Baklava'].quantity).toBe(1);
      expect(sum(Object.fromEntries(Object.entries(r.productSales).map(([k, v]: any) => [k, v.total])))).toBe(r.grossTotal);
      expect(r.giftTotal).toBe(80);
    }
  });

  it('kuruş toplamlarında kayan nokta hatası yok', () => {
    pay(0, [item('a', 0.1)], [['Nakit', 0.1]]);
    pay(1, [item('b', 0.2)], [['Nakit', 0.2]]);
    const f = rds.getFilteredReport({});
    expect(f.grossTotal).toBe(0.3);
    expect(f.netTotal).toBe(0.3);
    expect(f.paymentBreakdown['Nakit']).toBe(0.3);
  });

  it('gece yarısından sonra kapanan adisyon iş günü tarihiyle arşivlenir (05:00 kesimi)', () => {
    pay(0, [item('a', 10)], [['Nakit', 10]]);
    const o = rds.getAllCompletedOrders()[0];
    expect(o.date).toBe(getBusinessDate());
  });

  it('Z kapanışında girilmeyen açılış avansı için uydurma tutar yok', () => {
    pay(0, [item('a', 100)], [['Nakit', 100]]);
    const z = rds.closeDailyZReport('', 'Test');
    expect(z.openingCashFloat).toBe(0);
    expect(z.cashDifference).toBe(0);
  });
});
