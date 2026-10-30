import { describe, it, expect, beforeEach } from 'vitest';
import { freshServices, item } from './helpers/browserStub';
import { getBusinessDate } from '../src/utils/businessDate';

const sell = (rds: any, idx: number, total: number, type = 'Nakit') => {
  const t = rds.getTables()[idx];
  rds.updateTableOrder(t.id, [item('urun' + idx, total)]);
  expect(rds.completeTablePayment(t.id, 'x', [{ id: 'p' + idx, type, amount: total, time: '1' }]).success).toBe(true);
};

describe('X / Z raporu', () => {
  let rds: any, ds: any, store: Map<string, string>;
  beforeEach(async () => { ({ rds, ds, store } = await freshServices()); });

  it('toplamlar ödeme türüne göre doğru, nakit ve kart ayrı', () => {
    sell(rds, 0, 100.1);
    sell(rds, 1, 200.2, 'Kredi Kartı');
    sell(rds, 2, 50.05);
    const x = rds.getCurrentXReport();
    expect(x.grossTotal).toBe(350.35);
    expect(x.paymentBreakdown['Nakit']).toBe(150.15);
    expect(x.paymentBreakdown['Kredi Kartı']).toBe(200.2);
    expect(x.totalOrders).toBe(3);
  });

  it('float birikimi kuruş hatası üretmez (0.1 + 0.2 gibi)', () => {
    sell(rds, 0, 0.1);
    sell(rds, 1, 0.2);
    expect(rds.getCurrentXReport().grossTotal).toBe(0.3);
  });

  it('nakit gider kasadaki net nakitten düşer, banka gideri düşmez', () => {
    sell(rds, 0, 1000);
    ds.addExpense({ title: 'Gaz', category: 'Fatura', amount: 150, paymentMethod: 'CASH', date: getBusinessDate() });
    ds.addExpense({ title: 'Kira', category: 'Kira', amount: 500, paymentMethod: 'BANK', date: getBusinessDate() });
    const x = rds.getCurrentXReport();
    expect(x.cashExpenses).toBe(150);
    expect(x.bankExpenses).toBe(500);
    expect(x.netCashInRegister).toBe(850);
  });

  it('AYNI GÜN İKİNCİ Z: giderler ve satışlar ÇİFT SAYILMAZ', () => {
    sell(rds, 0, 1000);
    ds.addExpense({ title: 'Gaz', category: 'Fatura', amount: 150, paymentMethod: 'CASH', date: getBusinessDate() });
    const z1 = rds.closeDailyZReport('1. Z', 'T');
    expect(z1.grossTotal).toBe(1000);
    expect(z1.cashExpenses).toBe(150);

    sell(rds, 1, 400);
    ds.addExpense({ title: 'Su', category: 'Fatura', amount: 40, paymentMethod: 'CASH', date: getBusinessDate() });
    const z2 = rds.closeDailyZReport('2. Z', 'T');
    expect(z2.grossTotal).toBe(400);
    expect(z2.cashExpenses).toBe(40);
    expect(z2.zNo).toBe(z1.zNo + 1);
  });

  it('Z sonrası X raporu sıfırlanır; arşivdeki adisyonlar Z ile ilişkilendirilir', () => {
    sell(rds, 0, 500);
    const z = rds.closeDailyZReport('', 'T');
    const x = rds.getCurrentXReport();
    expect(x.grossTotal).toBe(0);
    expect(x.totalOrders).toBe(0);
    expect(rds.getAllCompletedOrders().every((o: any) => o.zReportId === z.id)).toBe(true);
  });

  it('Z sonrası iptal kayıtları SİLİNMEZ (denetim izi); yeni X raporuna girmez', () => {
    const t = rds.getTables()[0];
    rds.updateTableOrder(t.id, [item('kebap', 300)]);
    rds.cancelTableOrder(t.id, 'Müşteri vazgeçti');
    expect(rds.getCurrentXReport().cancelLogs.length).toBeGreaterThan(0);

    const z = rds.closeDailyZReport('', 'T');
    const x2 = rds.getCurrentXReport();
    expect(x2.cancelLogs).toHaveLength(0);
    expect(x2.cancelTotal).toBe(0);

    const stored = JSON.parse(store.get('gtu_pos_cancel_logs') || '[]');
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((c: any) => c.zReportId === z.id)).toBe(true);
  });
});
