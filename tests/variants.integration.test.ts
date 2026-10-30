// Ürün seçenekleri (boyut/porsiyon, her birinin kendi fiyatı): GERÇEK PHP + MySQL (izole test veritabanı). TEST_API_URL gerekir.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { API, call, testSql, seedWaiterAndProduct } from './helpers/apiTestKit';

const d = API ? describe : describe.skip;
const WID = 'w-test-var', PIN = '2468', PLAIN = 'p-test-var-plain', AYRAN = 'p-test-var-ayran', KEBAP = 'p-test-var-kebap';
const V = { s: 'v-330', l: 'v-1lt', p1: 'v-1p', p15: 'v-15p' };

d('ürün seçenekleri (gerçek PHP+MySQL)', () => {
  let h: Record<string, string> = {};
  const order = (items: any[], extra: any = {}) => call('send_order', {
    body: { clientOrderId: 'var' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36), tableId: 'tbl-sec-salon-5', tableName: 'x', items, ...extra },
    headers: h,
  });
  afterAll(() => { testSql("DELETE FROM urunler WHERE id LIKE 'p-test-var%'"); }); // ortak test veritabanını kirletme
  const rowOf = (cid: string) => testSql(`SELECT toplam_tutar, kalemler FROM siparisler WHERE id='ord-${cid}'`).trim().split('\t');

  beforeAll(async () => {
    seedWaiterAndProduct(WID, PIN, PLAIN, 50);
    // Kasa ürünleri seçenekleriyle sunucuya eşitler
    const push = await call('push_kasa_state', {
      kasa: true,
      body: {
        categories: [{ id: 'k-test', name: 'Test' }],
        products: [
          { id: AYRAN, categoryId: 'k-test', name: 'Ayran', price: 25, variants: [{ id: V.s, name: '330 ml', price: 25 }, { id: V.l, name: '1 Litre', price: 60.5 }] },
          { id: KEBAP, categoryId: 'k-test', name: 'Test Kebap', price: 280, variants: [{ id: V.p1, name: '1 Porsiyon', price: 280 }, { id: V.p15, name: '1,5 Porsiyon', price: 400 }] },
          { id: PLAIN, categoryId: 'k-test', name: 'Test Urun', price: 50 },
        ],
      },
    });
    expect(push.status).toBe(200);
    const mk = await call('create_pairing_token', { kasa: true, body: { userId: WID } });
    const ok = await call('pair_with_code', { body: { code: mk.data.pairingCode, device_uuid: 'dev-var-1' } });
    const pin = await call('verify_waiter_pin', { body: { pin: PIN }, headers: { 'X-Device-Token': ok.data.device_token } });
    h = { 'X-Device-Token': ok.data.device_token, 'X-Session': pin.data.session };
  });

  it('seçenekler sunucuya kaydedilir ve menüde (kasa + garson) görünür', async () => {
    for (const r of [await call('get_live_state', { kasa: true }), await call('get_live_state', { headers: h })]) {
      const ay = r.data.products.find((p: any) => p.id === AYRAN);
      expect(ay.variants).toEqual([{ id: V.s, name: '330 ml', price: 25 }, { id: V.l, name: '1 Litre', price: 60.5 }]);
      expect(ay.price).toBe(25); // temel fiyat = en düşük seçenek
      expect(r.data.products.find((p: any) => p.id === PLAIN).variants).toEqual([]); // seçeneksiz ürün
      expect(JSON.stringify(r.data.products)).not.toContain('variantsJson');
    }
  });

  it('garson: seçenek fiyatı sunucuda belirlenir; istemci fiyatı ve adı yok sayılır', async () => {
    const cid = 'v1' + Date.now().toString(36) + 'aaaaaa';
    const r = await order([{ productId: AYRAN, variantId: V.l, productName: 'SAHTE AD', price: 1, quantity: 2, portion: 1 }], { clientOrderId: cid });
    expect(r.status).toBe(200);
    const [total, items] = rowOf(cid);
    expect(Number(total)).toBe(121); // 2 x 60,50 (istemci 1 ₺ dedi)
    const it = JSON.parse(items)[0];
    expect(it.productName).toBe('Ayran (1 Litre)');
    expect(it.price).toBe(60.5);
    expect(it.variantId).toBe(V.l);
  });

  it('aynı üründe farklı seçenekler ayrı kalem ve doğru toplam olur', async () => {
    const cid = 'v2' + Date.now().toString(36) + 'bbbbbb';
    const r = await order([
      { productId: KEBAP, variantId: V.p1, quantity: 1, portion: 1 },
      { productId: KEBAP, variantId: V.p15, quantity: 2, portion: 1 },
    ], { clientOrderId: cid });
    expect(r.status).toBe(200);
    const [total, items] = rowOf(cid);
    expect(Number(total)).toBe(280 + 2 * 400);
    expect(JSON.parse(items).map((i: any) => i.productName)).toEqual(['Test Kebap (1 Porsiyon)', 'Test Kebap (1,5 Porsiyon)']);
  });

  it('seçenekli üründe seçenek ZORUNLU; geçersiz seçenek ve 0,5x/1,5x çarpanı reddedilir; kayıt oluşmaz', async () => {
    const before = testSql('SELECT COUNT(*) FROM siparisler').trim();
    const none = await order([{ productId: AYRAN, quantity: 1, portion: 1 }]);
    expect(none.status).toBe(422);
    expect(none.data.code).toBe('VARIANT_REQUIRED');
    const bad = await order([{ productId: AYRAN, variantId: 'yok', quantity: 1, portion: 1 }]);
    expect(bad.status).toBe(422);
    expect(bad.data.code).toBe('VARIANT_INVALID');
    const other = await order([{ productId: AYRAN, variantId: V.p1, quantity: 1, portion: 1 }]); // başka ürünün seçeneği
    expect(other.status).toBe(422);
    const mult = await order([{ productId: AYRAN, variantId: V.s, quantity: 1, portion: 1.5 }]);
    expect(mult.status).toBe(422);
    expect(testSql('SELECT COUNT(*) FROM siparisler').trim()).toBe(before);
  });

  it('seçeneksiz üründe seçenek kimliği yok sayılır ve eski fiyat kuralı korunur', async () => {
    const cid = 'v3' + Date.now().toString(36) + 'cccccc';
    const r = await order([{ productId: PLAIN, variantId: V.l, quantity: 1, portion: 1 }], { clientOrderId: cid });
    expect(r.status).toBe(200);
    const [total, items] = rowOf(cid);
    expect(Number(total)).toBe(50);
    expect(JSON.parse(items)[0].variantId).toBeUndefined();
  });

  it('QR menü müşterisi de seçenekli ürünü seçenek olmadan sipariş edemez; fiyatı sunucu belirler', async () => {
    const tokens = (await call('get_table_qr_tokens', { kasa: true })).data.tokens;
    const tableId = 'tbl-sec-salon-6';
    const qr = (items: any[]) => call('qr_send', { body: { type: 'ORDER', tableId, tableName: 'x', qrt: tokens[tableId], clientOrderId: 'qr' + Math.random().toString(36).slice(2, 12) + 'zz', items } });
    const no = await qr([{ productId: AYRAN, quantity: 1 }]);
    expect(no.status).toBe(422);
    const ok = await qr([{ productId: AYRAN, variantId: V.s, price: 0.01, quantity: 1 }]);
    expect(ok.status).toBe(200);
    const last = testSql(`SELECT toplam_tutar FROM siparisler WHERE masa_id='${tableId}' ORDER BY olusturma_tarihi DESC LIMIT 1`).trim();
    expect(Number(last)).toBe(25);
  });

  it('seçenekler kaldırılınca ürün tek fiyatlı sipariş alır (geri dönüşüm)', async () => {
    await call('push_kasa_state', { kasa: true, body: { products: [{ id: AYRAN, categoryId: 'k-test', name: 'Ayran', price: 30 }] } });
    const live = await call('get_live_state', { kasa: true });
    expect(live.data.products.find((p: any) => p.id === AYRAN).variants).toEqual([]);
    const r = await order([{ productId: AYRAN, quantity: 1, portion: 1 }]);
    expect(r.status).toBe(200);
  });
});
