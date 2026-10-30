import { describe, it, expect, beforeEach } from 'vitest';
import { freshServices, item } from './helpers/browserStub';
import { getBusinessDate } from '../src/utils/businessDate';

describe('ödeme ve adisyon kapatma', () => {
  let rds: any;
  beforeEach(async () => { ({ rds } = await freshServices()); });

  it('doğru toplamlı ödeme adisyonu kapatır, arşive yazar', () => {
    const t = rds.getTables()[0];
    rds.updateTableOrder(t.id, [item('kebap', 250, 2), item('ayran', 30, 2)]);
    const r = rds.completeTablePayment(t.id, 'Tamamlandı', [
      { id: 'p1', type: 'Nakit', amount: 300, time: '12:00' },
      { id: 'p2', type: 'Kredi Kartı', amount: 260, time: '12:01' },
    ]);
    expect(r.success).toBe(true);
    expect(rds.getTables().find((x: any) => x.id === t.id).status).toBe('EMPTY');
    const arch = rds.getAllCompletedOrders();
    expect(arch).toHaveLength(1);
    expect(arch[0].totalAmount).toBe(560);
    expect(arch[0].date).toBe(getBusinessDate());
  });

  it('eksik veya fazla ödeme adisyonu KAPATMAZ ve hiçbir şey kaydetmez', () => {
    const t = rds.getTables()[0];
    rds.updateTableOrder(t.id, [item('kebap', 250, 2)]);
    const eksik = rds.completeTablePayment(t.id, 'x', [{ id: 'p', type: 'Nakit', amount: 400, time: '1' }]);
    expect(eksik.success).toBe(false);
    const fazla = rds.completeTablePayment(t.id, 'x', [{ id: 'p', type: 'Nakit', amount: 600, time: '1' }]);
    expect(fazla.success).toBe(false);
    expect(rds.getAllCompletedOrders()).toHaveLength(0);
    expect(rds.getTables().find((x: any) => x.id === t.id).order.items).toHaveLength(1);
  });

  it('çift tıklama: ikinci kapatma başarısız olur, arşivde tek kayıt kalır', () => {
    const t = rds.getTables()[0];
    rds.updateTableOrder(t.id, [item('çorba', 100)]);
    const pay = [{ id: 'p', type: 'Nakit', amount: 100, time: '1' }];
    expect(rds.completeTablePayment(t.id, 'x', pay).success).toBe(true);
    expect(rds.completeTablePayment(t.id, 'x', pay).success).toBe(false);
    expect(rds.getAllCompletedOrders()).toHaveLength(1);
  });

  it('ikram kalemleri toplama girmez', () => {
    const t = rds.getTables()[0];
    rds.updateTableOrder(t.id, [item('kebap', 250), item('baklava', 100, 1, { isGift: true })]);
    const r = rds.completeTablePayment(t.id, 'x', [{ id: 'p', type: 'Nakit', amount: 250, time: '1' }]);
    expect(r.success).toBe(true);
    expect(rds.getAllCompletedOrders()[0].totalAmount).toBe(250);
  });

  it('ödeme listesi boşsa tek ödeme olarak toplam yazılır', () => {
    const t = rds.getTables()[0];
    rds.updateTableOrder(t.id, [item('çorba', 80)]);
    expect(rds.completeTablePayment(t.id, 'Nakit').success).toBe(true);
    expect(rds.getAllCompletedOrders()[0].payments[0].amount).toBe(80);
  });

  it('boş masa için başarısız döner', () => {
    expect(rds.completeTablePayment(rds.getTables()[1].id, 'Nakit').success).toBe(false);
  });
});
