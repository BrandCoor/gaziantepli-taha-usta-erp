// Yalnızca izole TEST sunucusuna karşı çalışır. Örn: TEST_API_URL=http://127.0.0.1:8080/api/index.php
import { describe, it, expect, beforeAll } from 'vitest';

import { API, call as rawCall, seedLayout } from './helpers/apiTestKit';
const d = API ? describe : describe.skip;

// Kasa anahtarıyla çağrı (kasa tarafı akışları)
const call = async (action: string, body?: any) => rawCall(action, { body, kasa: true });

d('send_order / pull / ack (gerçek PHP+MySQL)', () => {
  beforeAll(() => seedLayout());
  const tableId = 'tbl-sec-salon-1';
  const cid = 'test' + Date.now().toString(36) + 'abcdef';
  const payload = { clientOrderId: cid, tableId, tableName: 'Ana Salon 1', waiterName: 'T', items: [{ productName: 'X', price: 10, quantity: 2 }], totalAmount: 20 };

  it('aynı clientOrderId iki kez gelince tek kayıt oluşur', async () => {
    const a = await call('send_order', payload);
    const b = await call('send_order', payload);
    expect(a.data.success).toBe(true);
    expect(b.data.success).toBe(true);
    expect(b.data.duplicate).toBe(true);
    expect(a.data.orderId).toBe(b.data.orderId);
    const pend = await call('pull_pending_orders');
    const mine = pend.data.orders.filter((o: any) => o.id === a.data.orderId);
    expect(mine).toHaveLength(1);
    expect(mine[0].items).toHaveLength(1); // regresyon: kalemler boş dönüyordu
  });

  it('pull siparişi tüketmez; ack sonrası kaybolur', async () => {
    const id = 'ord-' + cid;
    const p1 = await call('pull_pending_orders');
    const p2 = await call('pull_pending_orders');
    expect(p1.data.orders.some((o: any) => o.id === id)).toBe(true);
    expect(p2.data.orders.some((o: any) => o.id === id)).toBe(true);
    const ack = await call('ack_orders', { ids: [id] });
    expect(ack.data.acked).toBe(1);
    const p3 = await call('pull_pending_orders');
    expect(p3.data.orders.some((o: any) => o.id === id)).toBe(false);
  });

  it('tekrar gönderim masayı ikinci kez toplamaz', async () => {
    const live = await call('get_live_state');
    const t = live.data.tables.find((x: any) => x.id === tableId);
    const q = (t.order?.items || []).filter((i: any) => i.productName === 'X').reduce((s: number, i: any) => s + i.quantity, 0);
    expect(q).toBeGreaterThanOrEqual(2);
    const c2 = 'tst2' + cid;
    await call('send_order', { ...payload, clientOrderId: c2 });
    await call('send_order', { ...payload, clientOrderId: c2 });
    const live2 = await call('get_live_state');
    const t2 = live2.data.tables.find((x: any) => x.id === tableId);
    const q2 = (t2.order?.items || []).filter((i: any) => i.productName === 'X').reduce((s: number, i: any) => s + i.quantity, 0);
    expect(q2).toBe(q + 2);
  });
});
