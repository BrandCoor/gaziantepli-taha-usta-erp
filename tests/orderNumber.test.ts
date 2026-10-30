import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { freshServices, item } from './helpers/browserStub';

describe('adisyon numarası', () => {
  let rds: any;
  beforeEach(async () => { ({ rds } = await freshServices()); });
  afterEach(() => vi.useRealTimers());

  it('aynı gün içinde 1, 2, 3… şeklinde artar ve ÇAKIŞMAZ', () => {
    const tables = rds.getTables();
    const nums: number[] = [];
    for (let i = 0; i < 12; i++) {
      rds.updateTableOrder(tables[i].id, [item('x' + i, 10)]);
      nums.push(rds.getTables()[i].order.orderNumber);
    }
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(nums).size).toBe(12);
  });

  it('mevcut adisyona ürün eklemek numarayı DEĞİŞTİRMEZ', () => {
    const t = rds.getTables()[0];
    rds.updateTableOrder(t.id, [item('a', 10)]);
    const first = rds.getTables()[0].order.orderNumber;
    rds.updateTableOrder(t.id, [item('a', 10), item('b', 20)]);
    expect(rds.getTables()[0].order.orderNumber).toBe(first);
  });

  it('yeni iş gününde sayaç 1\'e döner (05:00 sınırı)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 30, 20, 0, 0));
    const t = rds.getTables();
    rds.updateTableOrder(t[0].id, [item('a', 10)]);
    rds.updateTableOrder(t[1].id, [item('b', 10)]);
    expect(rds.getTables()[1].order.orderNumber).toBe(2);
    vi.setSystemTime(new Date(2026, 9, 31, 2, 0, 0));  // gece 02:00 → hâlâ aynı iş günü
    rds.updateTableOrder(t[2].id, [item('c', 10)]);
    expect(rds.getTables()[2].order.orderNumber).toBe(3);
    vi.setSystemTime(new Date(2026, 9, 31, 6, 0, 0));  // 06:00 → yeni iş günü
    rds.updateTableOrder(t[3].id, [item('d', 10)]);
    expect(rds.getTables()[3].order.orderNumber).toBe(1);
  });
});
