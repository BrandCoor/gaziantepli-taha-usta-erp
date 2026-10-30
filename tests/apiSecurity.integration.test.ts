// İzole TEST sunucusuna karşı çalışır (TEST_API_URL). Gerçek veriye dokunmaz.
import { describe, it, expect, beforeAll } from 'vitest';
import { API, call, testSql, seedWaiterAndProduct } from './helpers/apiTestKit';

const d = API ? describe : describe.skip;
const WID = 'w-test-sec';
const PID = 'p-test-sec';
const PIN = '4321';

d('API güvenliği (gerçek PHP+MySQL)', () => {
  let deviceToken = '';
  let session = '';

  beforeAll(() => {
    seedWaiterAndProduct(WID, PIN, PID, 50);
  });

  it('kimliksiz istekler reddedilir (varsayılan: kapalı)', async () => {
    for (const action of ['get_live_state', 'get_all_erp_data', 'push_kasa_state', 'pull_pending_orders', 'ack_orders', 'delete_item', 'save_printer', 'get_paired_devices', 'create_pairing_token', 'reset_device_pairing', 'test_db', 'bilinmeyen_eylem']) {
      const r = await call(action);
      expect(r.status, action).toBe(401);
    }
  });

  it('yanlış kasa anahtarı reddedilir', async () => {
    const r = await call('get_all_erp_data', { headers: { 'X-Kasa-Key': 'yanlis-anahtar-yanlis-anahtar' } });
    expect(r.status).toBe(401);
  });

  it('health herkese açık ama ayrıntı sızdırmaz', async () => {
    const r = await call('health');
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.data)).not.toMatch(/database|host|tables/i);
  });

  it('get_active_waiters kimliksiz çağrılamaz; kasa ile PIN/telefon/QR dönmez', async () => {
    expect((await call('get_active_waiters')).status).toBe(401);
    const r = await call('get_active_waiters', { kasa: true });
    expect(r.status).toBe(200);
    const w = r.data.waiters.find((x: any) => x.id === WID);
    expect(w).toBeTruthy();
    expect(Object.keys(w).sort()).toEqual(['id', 'name', 'role']);
  });

  it('eşleştirme: rastgele/yanlış kod hiçbir garsonu eşleştirmez', async () => {
    const r = await call('pair_with_code', { body: { code: '000000', device_uuid: 'dev-x' } });
    expect(r.status).toBe(401);
    expect(r.data.success).toBe(false);
  });

  it('eşleştirme: kasa kodu üretir, kod bir kez kullanılabilir, PIN dönmez', async () => {
    const mk = await call('create_pairing_token', { kasa: true, body: { userId: WID } });
    expect(mk.status).toBe(200);
    expect(mk.data.pairingCode).toMatch(/^\d{6}$/);
    const code = mk.data.pairingCode;

    const ok = await call('pair_with_code', { body: { code, device_uuid: 'dev-test-1' } });
    expect(ok.status).toBe(200);
    expect(ok.data.device_token).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ok.data)).not.toContain(PIN);
    deviceToken = ok.data.device_token;

    const again = await call('pair_with_code', { body: { code, device_uuid: 'dev-test-2' } });
    expect(again.status).toBe(401); // tek kullanımlık
  });

  it('eşleştirme: süresi dolmuş kod reddedilir', async () => {
    const mk = await call('create_pairing_token', { kasa: true, body: { userId: WID } });
    testSql(`UPDATE personeller SET pairing_expires_at = NOW() - INTERVAL 1 MINUTE WHERE id='${WID}'`);
    const r = await call('pair_with_code', { body: { code: mk.data.pairingCode, device_uuid: 'dev-test-3' } });
    expect(r.status).toBe(401);
  });

  it('PIN: cihaz anahtarı olmadan reddedilir; yanlış PIN reddedilir; doğru PIN oturum verir', async () => {
    expect((await call('verify_waiter_pin', { body: { pin: PIN } })).status).toBe(401);
    const bad = await call('verify_waiter_pin', { body: { pin: '0000' }, headers: { 'X-Device-Token': deviceToken } });
    expect(bad.status).toBe(401);
    const good = await call('verify_waiter_pin', { body: { pin: PIN, waiterId: 'baska-biri' }, headers: { 'X-Device-Token': deviceToken } });
    expect(good.status).toBe(200);
    expect(good.data.waiter.id).toBe(WID); // istemcinin waiterId'si yok sayılır
    expect(JSON.stringify(good.data)).not.toContain(PIN);
    session = good.data.session;
    expect(session).toBeTruthy();
  });

  it('PIN brute-force: ardışık yanlış denemeler 429 ile durdurulur', async () => {
    let last = 0;
    for (let i = 0; i < 14; i++) {
      const r = await call('verify_waiter_pin', { body: { pin: String(1000 + i) }, headers: { 'X-Device-Token': deviceToken } });
      last = r.status;
      if (r.status === 429) break;
    }
    expect(last).toBe(429);
    testSql('DELETE FROM rate_limits');
  });

  it('sipariş: oturum (PIN) olmadan reddedilir; sahte oturum reddedilir', async () => {
    const body = { clientOrderId: 'sec' + Date.now() + 'aaaaaa', tableId: 'tbl-sec-salon-2', tableName: 'x', items: [{ productId: PID, quantity: 1, portion: 1, price: 1 }] };
    expect((await call('send_order', { body, headers: { 'X-Device-Token': deviceToken } })).status).toBe(401);
    expect((await call('send_order', { body, headers: { 'X-Device-Token': deviceToken, 'X-Session': 'sahte.imza' } })).status).toBe(401);
  });

  it('sipariş: istemci fiyatı yok sayılır, sunucu fiyatı uygulanır; garson adı token\'dan gelir', async () => {
    const cid = 'prc' + Date.now().toString(36) + 'zzzzzz';
    const r = await call('send_order', {
      body: { clientOrderId: cid, tableId: 'tbl-sec-salon-3', tableName: 'Ana Salon 3', waiterName: 'SAHTE ISIM', totalAmount: 1, items: [{ productId: PID, productName: 'Test Urun', price: 1, quantity: 2, portion: 1 }] },
      headers: { 'X-Device-Token': deviceToken, 'X-Session': session }
    });
    expect(r.status).toBe(200);
    const row = testSql(`SELECT toplam_tutar, garson_adi FROM siparisler WHERE id='ord-${cid}'`).trim().split('\t');
    expect(Number(row[0])).toBe(100); // 2 x 50 (istemci 1 TL dedi)
    expect(row[1]).toBe('Test Garson');
  });

  it('sipariş: bilinmeyen ürün ve geçersiz adet reddedilir', async () => {
    const h = { 'X-Device-Token': deviceToken, 'X-Session': session };
    const mk = (items: any[]) => ({ clientOrderId: 'bad' + Math.random().toString(36).slice(2, 12), tableId: 'tbl-sec-salon-4', tableName: 'x', items });
    expect((await call('send_order', { body: mk([{ productId: 'yok', quantity: 1, portion: 1 }]), headers: h })).status).toBe(422);
    expect((await call('send_order', { body: mk([{ productId: PID, quantity: 0, portion: 1 }]), headers: h })).status).toBe(422);
    expect((await call('send_order', { body: mk([{ productId: PID, quantity: 1, portion: 7 }]), headers: h })).status).toBe(422);
    expect((await call('send_order', { body: mk([]), headers: h })).status).toBe(422);
  });

  it('cihaz yetkisi iptal edilince (reset) token geçersiz olur', async () => {
    const r = await call('reset_device_pairing', { kasa: true, body: { userId: WID } });
    expect(r.status).toBe(200);
    const after = await call('get_live_state', { headers: { 'X-Device-Token': deviceToken, 'X-Session': session } });
    expect(after.status).toBe(401);
  });

  it('garson pasif yapılınca cihaz anahtarı çalışmaz', async () => {
    const mk = await call('create_pairing_token', { kasa: true, body: { userId: WID } });
    const ok = await call('pair_with_code', { body: { code: mk.data.pairingCode, device_uuid: 'dev-test-4' } });
    const tok = ok.data.device_token;
    testSql(`UPDATE personeller SET aktif=0 WHERE id='${WID}'`);
    const r = await call('verify_waiter_pin', { body: { pin: PIN }, headers: { 'X-Device-Token': tok } });
    expect(r.status).toBe(401);
    testSql(`UPDATE personeller SET aktif=1 WHERE id='${WID}'`);
  });

  it('patron: parolasız/yanlış parola reddedilir; doğru parola imzalı token verir; token olmadan rapor yok', async () => {
    expect((await call('get_boss_summary')).status).toBe(401);
    expect((await call('boss_login', { body: { password: 'yanlis' } })).status).toBe(401);
    const ok = await call('boss_login', { body: { password: 'test-boss-password' } });
    expect(ok.status).toBe(200);
    expect(ok.data.token).toContain('.');
    const rep = await call('get_boss_summary', { headers: { Authorization: `Bearer ${ok.data.token}` } });
    expect(rep.status).toBe(200);
    expect((await call('get_boss_summary', { headers: { Authorization: 'Bearer ' + ok.data.token + 'x' } })).status).toBe(401);
    testSql('DELETE FROM rate_limits');
  });

  it('patron girişi hız sınırlı (brute-force)', async () => {
    let last = 0;
    for (let i = 0; i < 8; i++) { last = (await call('boss_login', { body: { password: 'x' + i } })).status; if (last === 429) break; }
    expect(last).toBe(429);
    testSql('DELETE FROM rate_limits');
  });

  describe('QR menü (müşteri, herkese açık yollar)', () => {
    const TBL = 'tbl-sec-salon-5';
    let qrt = '';
    beforeAll(async () => {
      qrt = (await call('get_table_qr_tokens', { kasa: true })).data.tokens[TBL];
      testSql('DELETE FROM rate_limits');
    });

    it('belirteç yalnızca kasaya verilir, 20 karakter', async () => {
      expect((await call('get_table_qr_tokens')).status).toBe(401);
      expect(qrt).toMatch(/^[0-9a-f]{20}$/);
    });

    it('qr_menu kimliksiz açık ama masa adisyonu/durumu sızdırmaz', async () => {
      const r = await call('qr_menu');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.data.products)).toBe(true);
      for (const t of r.data.tables) { expect(Object.keys(t).sort()).toEqual(['id', 'name', 'sectionId', 'sectionName']); }
    });

    it('qr_table_state: belirteçsiz/yanlış belirteçle 403', async () => {
      const bad = await fetch(`${API}?action=qr_table_state&table=${TBL}&qrt=yanlis`);
      expect(bad.status).toBe(403);
      const none = await fetch(`${API}?action=qr_table_state&table=${TBL}`);
      expect(none.status).toBe(403);
      const ok = await fetch(`${API}?action=qr_table_state&table=${TBL}&qrt=${qrt}`);
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as any).table.id).toBe(TBL);
    });

    it('başka masanın belirteci bu masa için geçmez', async () => {
      const other = (await call('get_table_qr_tokens', { kasa: true })).data.tokens['tbl-sec-salon-6'];
      const r = await call('qr_send', { body: { type: 'WAITER_CALL', tableId: TBL, tableName: 'x', qrt: other } });
      expect(r.status).toBe(403);
    });

    it('qr_send: sipariş sunucu fiyatıyla kaydedilir, tekrar gönderim çift kayıt oluşturmaz', async () => {
      const cid = 'qr' + Date.now().toString(36) + 'abcdefgh';
      const body = { type: 'ORDER', tableId: TBL, tableName: 'Ana Salon 5', qrt, clientOrderId: cid, items: [{ productId: PID, productName: 'x', price: 1, quantity: 3 }] };
      const a = await call('qr_send', { body });
      const b = await call('qr_send', { body });
      expect(a.status).toBe(200);
      expect(b.data.duplicate).toBe(true);
      const row = testSql(`SELECT toplam_tutar, garson_adi FROM siparisler WHERE id='ord-${cid}'`).trim().split('	');
      expect(Number(row[0])).toBe(150);
      expect(row[1]).toContain('QR Men');
    });

    it('qr_send: izin verilmeyen tür (TRANSFER_TABLE) ve hız sınırı', async () => {
      expect((await call('qr_send', { body: { type: 'TRANSFER_TABLE', tableId: TBL, qrt, sourceTableId: TBL, targetTableId: 'tbl-sec-salon-9' } })).status).toBe(400);
      let last = 0;
      for (let i = 0; i < 20; i++) { last = (await call('qr_send', { body: { type: 'WAITER_CALL', tableId: TBL, tableName: 'x', qrt } })).status; if (last === 429) break; }
      expect(last).toBe(429);
      testSql('DELETE FROM rate_limits');
    });
  });

  describe('Online platform uçları', () => {
    const base = (API ?? 'http://x/api/index.php').replace('/index.php', '/online');
    it('action.php ve orders.php kimliksiz çağrılamaz', async () => {
      expect((await fetch(`${base}/orders.php?action=list`)).status).toBe(401);
      expect((await fetch(`${base}/action.php?action=accept`, { method: 'POST', body: '{}' })).status).toBe(401);
    });
    it('webhook: gizli anahtar yoksa reddedilir; yanlış imza reddedilir; doğru imza kabul', async () => {
      testSql("UPDATE online_platforms SET webhook_secret='' WHERE platform_code='TRENDYOL'");
      const payload = JSON.stringify({ orderNumber: 'T-' + Date.now(), customer: { firstName: 'A', lastName: 'B' }, totalPrice: 10, lines: [{ productName: 'x', quantity: 1, price: 10 }] });
      const url = `${API}?action=platform_webhook&platform=TRENDYOL`;
      expect((await fetch(url, { method: 'POST', body: payload })).status).toBe(403);
      testSql("UPDATE online_platforms SET webhook_secret='test-webhook-secret-123456' WHERE platform_code='TRENDYOL'");
      expect((await fetch(url, { method: 'POST', body: payload })).status).toBe(401);
      expect((await fetch(url, { method: 'POST', body: payload, headers: { 'X-Signature': 'yanlis' } })).status).toBe(401);
      const { createHmac } = await import('node:crypto');
      const sig = createHmac('sha256', 'test-webhook-secret-123456').update(payload).digest('hex');
      const ok = await fetch(url, { method: 'POST', body: payload, headers: { 'X-Signature': sig } });
      expect(ok.status).toBe(200);
      testSql("UPDATE online_platforms SET webhook_secret='' WHERE platform_code='TRENDYOL'");
    });
  });

  describe('CORS ön kontrol (Electron/tarayıcı)', () => {
    const A = API ?? 'http://x/api/index.php';
    const cases: Array<[string, string, string[]]> = [
      ['index.php', A, ['x-kasa-key', 'x-session', 'x-device-token']],
      ['auth.php', A.replace('index.php', 'auth.php'), ['x-kasa-key', 'x-session', 'x-device-token']],
      ['online/orders.php', A.replace('index.php', 'online/orders.php'), ['x-kasa-key']],
      ['online/action.php', A.replace('index.php', 'online/action.php'), ['x-kasa-key']],
    ];
    it.each(cases)('%s gerekli özel başlıklara izin verir', async (_n, url, needed) => {
      const r = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'null', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': needed.join(',') + ',content-type' } });
      const allow = (r.headers.get('access-control-allow-headers') || '').toLowerCase();
      for (const h of needed) expect(allow).toContain(h);
    });
  });
});
