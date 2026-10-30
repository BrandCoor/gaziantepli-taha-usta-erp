// Online yemek platformları: GERÇEK PHP + MySQL + sahte platform sunucusu (yalnızca test). TEST_API_URL gerekir.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { API, call, testSql } from './helpers/apiTestKit';

const d = API ? describe : describe.skip;
const MOCK = 'http://127.0.0.1:8090';
const ONLINE = (API ?? 'http://x/api/index.php').replace('/index.php', '/online');
let mock: ChildProcess | null = null;

function findPhp(): string {
  if (process.env.TEST_PHP_BIN) return process.env.TEST_PHP_BIN;
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  const dir = fs.readdirSync(base).find((x) => x.startsWith('PHP.PHP'));
  return path.join(base, dir!, 'php.exe');
}
const mockCfg = (c: object) => fetch(`${MOCK}/__config`, { method: 'POST', body: JSON.stringify(c) });
const mockCalls = async (): Promise<any[]> => (await fetch(`${MOCK}/__calls`)).json() as any;
const mockReset = () => fetch(`${MOCK}/__reset`);

const saveCfg = (platform: string, body: any) => call('save_online_platform_config', { kasa: true, body: { platform, ...body } });
const hook = (platform: string, payload: any, headers: Record<string, string> = {}, query = '') =>
  fetch(`${ONLINE}/webhook.php?platform=${platform}${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
const rows = (sql: string) => testSql(sql).trim();
const diag = async () => (await call('get_online_diagnostics', { kasa: true })).data;
const listOrders = async () => (await call('get_online_orders', { kasa: true })).data;

const GETIR_ORDER = (id: string) => ({
  id, confirmationId: 'C-' + id,
  client: { name: 'Ayşe Yılmaz', clientPhoneNumber: '05321112233', deliveryAddress: { address: 'Atatürk Cad. No:5', aptNo: '3', floor: '2' } },
  clientNote: 'Acısız olsun', totalPrice: 380, paymentMethodText: 'Online Kart',
  products: [{ name: 'Adana Kebap', count: 2, price: 150, optionCategories: [{ options: [{ name: 'Acısız' }] }] }, { name: 'Ayran', count: 1, price: 80 }],
});

d('Online platformlar (gerçek HTTP, gerçek veritabanı)', () => {
  beforeAll(async () => {
    testSql('DELETE FROM online_orders; DELETE FROM online_webhook_log; UPDATE online_platforms SET is_enabled=0, webhook_secret="", credentials_json="{}", token_cache=NULL, last_webhook_at=NULL;');
    mock = spawn(findPhp(), ['-S', '127.0.0.1:8090', path.resolve('tests/helpers/mockPlatform.php')], { stdio: 'ignore' });
    for (let i = 0; i < 40; i++) { try { await mockReset(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  });
  afterAll(() => { mock?.kill(); });

  it('webhook gizli anahtarı kaydedilmemişse 403 ve GÜNLÜĞE nedeniyle yazılır', async () => {
    const r = await hook('GETIR', GETIR_ORDER('g-0'), { 'x-api-key': 'herhangi' });
    expect(r.status).toBe(403);
    const dg = await diag();
    expect(dg.log[0].result).toBe('REJECTED');
    expect(dg.log[0].reason).toMatch(/Gizli Anahtar/i);
  });

  it('yanlış / eksik anahtar 401; günlük başlık İSİMLERİNİ gösterir, anahtar DEĞERİNİ göstermez', async () => {
    await saveCfg('GETIR', { credentials: {}, webhookSecret: 'getir-webhook-secret-123', isEnabled: true });
    expect((await hook('GETIR', GETIR_ORDER('g-1'), { 'x-api-key': 'yanlis' })).status).toBe(401);
    expect((await hook('GETIR', GETIR_ORDER('g-1'))).status).toBe(401);
    const dg = await diag();
    expect(dg.log[0].reason).toMatch(/yok/);
    expect(dg.log[1].header_names).toContain('x-api-key');
    expect(JSON.stringify(dg)).not.toContain('getir-webhook-secret-123');
    expect(JSON.stringify(dg)).not.toContain('yanlis');
    expect(rows("SELECT COUNT(*) FROM online_orders")).toBe('0');
  });

  it('GETIR: doğru x-api-key ile sipariş kaydedilir, kasada listelenir, kalemler/adres/telefon ayrıştırılır', async () => {
    const r = await hook('GETIR', GETIR_ORDER('g-2'), { 'x-api-key': 'getir-webhook-secret-123' }, '&event=new');
    expect(r.status).toBe(200);
    const list = await listOrders();
    const o = list.orders.find((x: any) => x.platformOrderId === 'g-2');
    expect(o).toBeTruthy();
    expect(o.customerName).toBe('Ayşe Yılmaz');
    expect(o.customerPhone).toBe('05321112233');
    expect(o.address).toContain('Atatürk Cad. No:5');
    expect(o.items).toHaveLength(2);
    expect(o.items[0]).toMatchObject({ name: 'Adana Kebap', quantity: 2, price: 150 });
    expect(o.items[0].options).toContain('Acısız');
    expect(o.totalAmount).toBe(380);
    expect(o.orderNote).toBe('Acısız olsun');
    expect(o.status).toBe('BEKLIYOR');
  });

  it('aynı sipariş ikinci kez gelirse YENİ KAYIT OLUŞMAZ (platform yeniden denemesi)', async () => {
    const r = await hook('GETIR', GETIR_ORDER('g-2'), { 'x-api-key': 'getir-webhook-secret-123' }, '&event=new');
    expect((await r.json() as any).duplicate).toBe(true);
    expect(rows("SELECT COUNT(*) FROM online_orders WHERE platform_order_id='g-2'")).toBe('1');
  });

  it('GETIR iptal olayı siparişi IPTAL yapar', async () => {
    await hook('GETIR', { id: 'g-2', cancelReason: 'Müşteri vazgeçti' }, { 'x-api-key': 'getir-webhook-secret-123' }, '&event=cancel');
    expect(rows("SELECT local_status, cancel_reason FROM online_orders WHERE platform_order_id='g-2'")).toBe('IPTAL\tMüşteri vazgeçti');
  });

  it('TRENDYOL: statik anahtar başlıkta VEYA sorguda kabul edilir', async () => {
    await saveCfg('TRENDYOL', { credentials: { supplierId: '123' }, webhookSecret: 'trendyol-static-secret', isEnabled: true });
    const payload = (id: string) => ({ orderId: id, orderNumber: 'TY-' + id, customer: { firstName: 'Mehmet', lastName: 'Kaya', phone: '05001112233' }, address: { fullAddress: 'Gazi Mah. 5. Sok.' }, lines: [{ name: 'Lahmacun', quantity: 3, price: 60 }], totalPrice: 180, paymentType: 'Kredi Kartı' });
    expect((await hook('TRENDYOL', payload('t-1'), { 'x-api-key': 'trendyol-static-secret' })).status).toBe(200);
    expect((await hook('TRENDYOL', payload('t-2'), {}, '&secret=trendyol-static-secret')).status).toBe(200);
    expect((await hook('TRENDYOL', payload('t-3'), { authorization: 'Bearer trendyol-static-secret' })).status).toBe(200);
    expect((await hook('TRENDYOL', payload('t-4'), { 'x-api-key': 'yanlis' })).status).toBe(401);
    const t = (await listOrders()).orders.find((x: any) => x.platformOrderId === 't-1');
    expect(t.customerName).toBe('Mehmet Kaya');
    expect(t.items[0]).toMatchObject({ name: 'Lahmacun', quantity: 3, price: 60 });
    expect(rows("SELECT COUNT(*) FROM online_orders WHERE platform_code='TRENDYOL'")).toBe('3');
  });

  it('YEMEKSEPETİ (POS Plugin): Bearer ile sipariş + callbackUrls saklanır; durum güncellemesi iptal eder', async () => {
    await saveCfg('YEMEKSEPETI', { credentials: { vendorId: 'V1' }, webhookSecret: 'ys-plugin-secret-xyz', isEnabled: true });
    const payload = { token: 'ys-tok-1', code: 'ABC1', customer: { firstName: 'Ali', lastName: 'Veli', mobilePhone: '05442223344' }, delivery: { address: { street: 'Çarşı Sk.', number: '7', city: 'Gaziantep' } }, comments: { customerComment: 'Kapıya bırakın' }, price: { grandTotal: 245.5 }, payment: { type: 'CASH' }, products: [{ name: 'Beyti', quantity: 1, unitPrice: 245.5, selectedToppings: [{ name: 'Yoğurtlu' }] }], callbackUrls: { orderAcceptedUrl: `${MOCK}/ys/orders/accept` } };
    const r = await fetch(`${ONLINE}/webhook.php?platform=YEMEKSEPETI&remoteId=R1`, { method: 'POST', headers: { 'Content-Type': 'application/json', authorization: 'Bearer ys-plugin-secret-xyz' }, body: JSON.stringify(payload) });
    expect(r.status).toBe(200);
    const o = (await listOrders()).orders.find((x: any) => x.platformOrderId === 'ys-tok-1');
    expect(o.customerName).toBe('Ali Veli');
    expect(o.address).toContain('Çarşı Sk.');
    expect(o.totalAmount).toBe(245.5);
    expect(o.orderNote).toBe('Kapıya bırakın');
    expect(o.items[0].options).toContain('Yoğurtlu');
    expect(rows("SELECT callback_urls_json FROM online_orders WHERE platform_order_id='ys-tok-1'")).toContain('orderAcceptedUrl');

    const st = await fetch(`${ONLINE}/webhook.php?platform=YEMEKSEPETI&kind=status&remoteId=R1&orderId=ys-tok-1`, { method: 'PUT', headers: { 'Content-Type': 'application/json', authorization: 'Bearer ys-plugin-secret-xyz' }, body: JSON.stringify({ status: 'order_cancelled', reason: 'Müşteri iptal' }) });
    expect(st.status).toBe(200);
    expect(rows("SELECT local_status FROM online_orders WHERE platform_order_id='ys-tok-1'")).toBe('IPTAL');
  });

  it('PASİF platformun siparişi KAYDEDİLİR ama listede gizlenir ve "gizli sipariş" olarak sayılır (kaybolmaz)', async () => {
    await call('toggle_online_platform', { kasa: true, body: { platform: 'GETIR', isEnabled: false } });
    await hook('GETIR', GETIR_ORDER('g-hidden'), { 'x-api-key': 'getir-webhook-secret-123' }, '&event=new');
    const l = await listOrders();
    expect(l.orders.some((x: any) => x.platformOrderId === 'g-hidden')).toBe(false);
    expect(l.hiddenCount).toBeGreaterThanOrEqual(1);
    const dg = await diag();
    expect(dg.hiddenOrders).toBeGreaterThanOrEqual(1);
    expect(dg.log.some((x: any) => /pasif/.test(x.reason))).toBe(true);
    await call('toggle_online_platform', { kasa: true, body: { platform: 'GETIR', isEnabled: true } });
    expect((await listOrders()).orders.some((x: any) => x.platformOrderId === 'g-hidden')).toBe(true);
  });

  it('SAHTE TEST SİPARİŞİ işlevi yok', async () => {
    const r = await call('create_test_online_order', { kasa: true, body: { platform: 'TRENDYOL' } });
    expect(r.data.success).not.toBe(true);
    expect(rows("SELECT COUNT(*) FROM online_orders WHERE platform_order_id LIKE 'TEST-%'")).toBe('0');
  });

  /* ---------------- GERÇEK bağlantı testi ---------------- */
  it('GETIR bağlantı testi: yanlış anahtar → BAŞARISIZ (sahte "doğrulandı" yok)', async () => {
    await saveCfg('GETIR', { credentials: { apiBaseUrl: MOCK, appKey: 'YANLIS', restaurantSecretKey: 'YANLIS' }, webhookSecret: 'getir-webhook-secret-123' });
    const r = await call('test_online_connection', { kasa: true, body: { platform: 'GETIR' } });
    expect(r.data.success).toBe(false);
    expect(r.data.message).toMatch(/Getir girişi başarısız.*401/);
  });

  it('GETIR bağlantı testi: doğru anahtar → platforma GERÇEK istek gider, başarılı', async () => {
    await mockReset();
    await saveCfg('GETIR', { credentials: { apiBaseUrl: MOCK, appKey: 'APP-OK', restaurantSecretKey: 'REST-OK' }, webhookSecret: 'getir-webhook-secret-123' });
    const r = await call('test_online_connection', { kasa: true, body: { platform: 'GETIR' } });
    expect(r.data.success).toBe(true);
    expect(r.data.verified).toBe(true);
    const calls = await mockCalls();
    expect(calls.find((c) => c.path === '/auth/login')?.body).toEqual({ appSecretKey: 'APP-OK', restaurantSecretKey: 'REST-OK' });
    expect(calls.find((c) => c.path === '/food-orders/active')?.headers.token).toBe('tok123');
  });

  it('TRENDYOL bağlantı testi: sipariş okuma adresi yoksa "DOĞRULANAMADI" (başarılı denmez)', async () => {
    const r = await call('test_online_connection', { kasa: true, body: { platform: 'TRENDYOL' } });
    expect(r.data.success).toBe(false);
    expect(r.data.message).toMatch(/DOĞRULANAMADI/);
  });

  it('TRENDYOL bağlantı testi: adres girilince Basic kimlik doğrulamasıyla gerçek istek atılır', async () => {
    await mockReset();
    await saveCfg('TRENDYOL', { credentials: { supplierId: '123', apiKey: 'TYKEY', secretKey: 'TYSEC', ordersUrl: `${MOCK}/ty/orders` }, webhookSecret: 'trendyol-static-secret' });
    expect((await call('test_online_connection', { kasa: true, body: { platform: 'TRENDYOL' } })).data.success).toBe(true);
    const c = (await mockCalls()).find((x) => x.path === '/ty/orders');
    expect(c.headers.authorization).toBe('Basic ' + Buffer.from('TYKEY:TYSEC').toString('base64'));
    expect(c.headers['user-agent']).toBe('123 - SelfIntegration');
    await saveCfg('TRENDYOL', { credentials: { supplierId: '123', apiKey: 'TYKEY', secretKey: 'YANLIS', ordersUrl: `${MOCK}/ty/orders` }, webhookSecret: 'trendyol-static-secret' });
    expect((await call('test_online_connection', { kasa: true, body: { platform: 'TRENDYOL' } })).data.success).toBe(false);
  });

  it('YEMEKSEPETİ bağlantı testi: OAuth client_credentials gerçekten denenir', async () => {
    await saveCfg('YEMEKSEPETI', { credentials: { tokenUrl: `${MOCK}/ys/oauth/token`, clientId: 'YANLIS', clientSecret: 'x' }, webhookSecret: 'ys-plugin-secret-xyz' });
    expect((await call('test_online_connection', { kasa: true, body: { platform: 'YEMEKSEPETI' } })).data.success).toBe(false);
    await saveCfg('YEMEKSEPETI', { credentials: { tokenUrl: `${MOCK}/ys/oauth/token`, clientId: 'YS-ID', clientSecret: 'YS-SECRET' }, webhookSecret: 'ys-plugin-secret-xyz' });
    expect((await call('test_online_connection', { kasa: true, body: { platform: 'YEMEKSEPETI' } })).data.success).toBe(true);
  });

  /* ---------------- sipariş çekme ---------------- */
  it('GETIR polling: aktif siparişler çekilir, tekrar çekmede çift kayıt olmaz', async () => {
    await mockReset();
    await mockCfg({ orders: [GETIR_ORDER('g-poll-1')] });
    const first = (await call('poll_online_orders', { kasa: true, body: {} })).data.results.GETIR;
    expect(first.error).toBeNull();
    expect(first.new).toBe(1);
    const second = (await call('poll_online_orders', { kasa: true, body: {} })).data.results.GETIR;
    expect(second.new).toBe(0);
    expect(rows("SELECT COUNT(*) FROM online_orders WHERE platform_order_id='g-poll-1'")).toBe('1');
  });

  it('GETIR polling: platform hatası gizlenmez, açıkça bildirilir', async () => {
    await mockCfg({ fail: true });
    const res = (await call('poll_online_orders', { kasa: true, body: {} })).data.results.GETIR;
    expect(res.error).toMatch(/500/);
    await mockCfg({ fail: false });
  });

  /* ---------------- platforma işlem bildirimi ---------------- */
  it('GETIR onay: platforma GERÇEK "verify" isteği gider; yerel durum HAZIRLANIYOR; sonuç raporlanır', async () => {
    await mockReset();
    const id = rows("SELECT id FROM online_orders WHERE platform_order_id='g-poll-1'");
    const r = (await call('accept_online_order', { kasa: true, body: { orderId: id } })).data;
    expect(r.success).toBe(true);
    expect(r.platformSync).toBe('OK');
    const calls = await mockCalls();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/food-orders/g-poll-1/verify' && c.headers.token === 'tok123')).toBe(true);
    expect(rows(`SELECT local_status, platform_sync_status FROM online_orders WHERE id=${id}`)).toBe('HAZIRLANIYOR\tOK');
  });

  it('GETIR onay: platform reddederse FAILED raporlanır (başarılı gibi gösterilmez)', async () => {
    await mockCfg({ fail: true });
    const id = rows("SELECT id FROM online_orders WHERE platform_order_id='g-poll-1'");
    const r = (await call('dispatch_online_order', { kasa: true, body: { orderId: id } })).data;
    expect(r.platformSync).toBe('FAILED');
    expect(r.platformSyncMessage).toMatch(/Getir/);
    expect(rows(`SELECT platform_sync_status FROM online_orders WHERE id=${id}`)).toBe('FAILED');
    await mockCfg({ fail: false });
  });

  it('GETIR iptal: sebep platforma iletilir', async () => {
    await mockReset();
    const id = rows("SELECT id FROM online_orders WHERE platform_order_id='g-poll-1'");
    const r = (await call('reject_online_order', { kasa: true, body: { orderId: id, cancelReason: 'Ürün tükendi' } })).data;
    expect(r.platformSync).toBe('OK');
    const c = (await mockCalls()).find((x) => x.path === '/food-orders/g-poll-1/cancel');
    expect(c.body).toEqual({ cancelNote: 'Ürün tükendi' });
    expect(rows(`SELECT local_status, cancel_reason FROM online_orders WHERE id=${id}`)).toBe('IPTAL\tÜrün tükendi');
  });

  it('TRENDYOL onay: adres tanımlı değilse MANUAL (platforma iletildi denmez)', async () => {
    const id = rows("SELECT id FROM online_orders WHERE platform_order_id='t-1'");
    const r = (await call('accept_online_order', { kasa: true, body: { orderId: id } })).data;
    expect(r.platformSync).toBe('MANUAL');
    expect(r.platformSyncMessage).toMatch(/platformun kendi uygulamasında/);
  });

  it('TRENDYOL onay: kullanıcının girdiği adres şablonu çağrılır', async () => {
    await mockReset();
    await saveCfg('TRENDYOL', { credentials: { supplierId: '123', apiKey: 'TYKEY', secretKey: 'TYSEC', acceptUrl: `${MOCK}/ty/{supplierId}/packages/{id}/accept`, acceptUrlMethod: 'PUT' }, webhookSecret: 'trendyol-static-secret' });
    const id = rows("SELECT id FROM online_orders WHERE platform_order_id='t-2'");
    const r = (await call('accept_online_order', { kasa: true, body: { orderId: id } })).data;
    expect(r.platformSync).toBe('OK');
    expect((await mockCalls()).some((c) => c.method === 'PUT' && c.path === '/ty/123/packages/t-2/accept')).toBe(true);
  });

  it('YEMEKSEPETİ onay: siparişin callbackUrls adresi + OAuth belirteci kullanılır', async () => {
    await mockReset();
    const id = rows("SELECT id FROM online_orders WHERE platform_order_id='ys-tok-1'");
    await saveCfg('YEMEKSEPETI', { credentials: { tokenUrl: `${MOCK}/ys/oauth/token`, clientId: 'YS-ID', clientSecret: 'YS-SECRET' }, webhookSecret: 'ys-plugin-secret-xyz' });
    const r = (await call('accept_online_order', { kasa: true, body: { orderId: id } })).data;
    expect(r.platformSync).toBe('OK');
    const c = (await mockCalls()).find((x) => x.path === '/ys/orders/accept');
    expect(c.headers.authorization).toBe('Bearer ys-tok');
    expect(c.body.status).toBe('order_accepted');
  });

  it('kimliksiz erişim: tanı, çekme ve işlem uçları kapalı', async () => {
    for (const a of ['get_online_diagnostics', 'poll_online_orders', 'accept_online_order', 'test_online_connection']) {
      expect((await call(a)).status, a).toBe(401);
    }
  });
});
