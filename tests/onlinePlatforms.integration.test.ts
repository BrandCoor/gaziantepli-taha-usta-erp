// Online yemek platformları: GERÇEK PHP + MySQL + resmi dokümandaki uçları/başlıkları taklit eden sahte sunucu (yalnızca test).
// Trendyol Go Yemek (Uber) ve Yemeksepeti Partner API. TEST_API_URL gerekir.
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
const mockState = async (): Promise<any> => (await fetch(`${MOCK}/__state`)).json();
const mockReset = () => fetch(`${MOCK}/__reset`);

const saveCfg = (platform: string, body: any) => call('save_online_platform_config', { kasa: true, body: { platform, ...body } });
const act = (action: string, body: any) => call(action, { kasa: true, body });
const hook = (platform: string, payload: any, headers: Record<string, string> = {}, query = '') =>
  fetch(`${ONLINE}/webhook.php?platform=${platform}${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
const rows = (sql: string) => testSql(sql).trim();
const diag = async () => (await call('get_online_diagnostics', { kasa: true })).data;
const listOrders = async (status = 'ALL') => (await call(`get_online_orders&status=${status}`, { kasa: true })).data;
const forcePoll = async () => (await call('poll_online_orders', { kasa: true, body: {} })).data;
const resetThrottle = () => testSql("DELETE FROM ayarlar WHERE anahtar LIKE 'op_last_poll_%' OR anahtar LIKE 'op_since_%'");

const TY = { supplierId: '100200', apiKey: 'TYKEY', secretKey: 'TYSEC', email: 'restoran@ornek.test', apiBaseUrl: MOCK };
const YS = { clientId: 'YS-ID', clientSecret: 'YS-SECRET', chainId: 'chain-1', vendorId: 'naez', apiBaseUrl: MOCK };
const nowMs = () => Date.now();

/** Resmi dokümandaki paket modeline (Model 1 = kendi kurye, Model 2 = Trendyol kuryesi) uygun örnek. */
const tyPackage = (id: string, o: any = {}) => ({
  id, supplierId: 100200, storeId: 153, orderCode: '4D5AC', deliveryType: 'STORE', packageStatus: 'Created',
  packageCreationDate: nowMs(), packageModificationDate: nowMs(), orderId: '1001' + id, orderNumber: '99' + id, totalPrice: 602.7,
  callCenterPhone: '0212 365 34 03', appName: 'TrendyolGo',
  customer: { id: 1, firstName: 'Ayşe', lastName: 'Yılmaz', email: 'a@b.c' },
  payment: { paymentType: 'PAY_WITH_CARD', mealCard: null, onDelivery: null },
  address: { firstName: 'Ayşe', lastName: 'Yılmaz', address1: 'Atatürk Cad. No:5', district: 'Şahinbey', neighborhood: 'Güvenevler', city: 'Gaziantep', apartmentNumber: '12', floor: '3', doorNumber: '7', addressDescription: 'Zil bozuk', phone: '0212 111 22 33', pinCode: '12345678' },
  customerNote: 'Acısız olsun',
  lines: [
    { price: 145, unitSellingPrice: 145, productId: 1, name: 'Adana Kebap Menü', items: [{ packageItemId: 'pi1', lineItemId: 1, isCancelled: false }, { packageItemId: 'pi2', lineItemId: 2, isCancelled: false }],
      modifierProducts: [{ name: 'Ayran (küçük)', price: 10, modifierProducts: [] }, { name: 'Közlenmiş Biber', price: 0, modifierProducts: [] }], extraIngredients: [{ name: 'Ekstra Acı' }], removedIngredients: [{ name: 'Soğan' }] },
    { price: 75, unitSellingPrice: 75, productId: 2, name: 'Lahmacun', items: [{ packageItemId: 'pi3', lineItemId: 3, isCancelled: false }, { packageItemId: 'pi4', lineItemId: 4, isCancelled: true }], modifierProducts: [] },
  ],
  ...o,
});

const ysOrder = (id: string, o: any = {}) => ({
  order_id: id, external_order_id: 'ext-' + id, order_code: 'abcd-1234', order_type: 'DELIVERY', status: 'RECEIVED', transport_type: 'LOGISTICS_DELIVERY', comment: 'Zili çalmayın',
  client: { chain_id: 'chain-1', store_id: 'naez', name: 'Taha Usta' },
  customer: { first_name: '***', last_name: '***', phone_number: '***', delivery_address: { street: 'Evergr******', building: '******', number: '12', city: 'Gaziantep', instructions: 'Leave ******' } },
  items: [{ _id: 'i1', name: 'Adana Kebap', pricing: { quantity: 2, unit_price: 280, total_price: 560 }, instructions: 'Acılı' }, { _id: 'i2', name: 'Ayran', pricing: { quantity: 1, unit_price: 40, total_price: 40 } }],
  payment: { order_total: 600, sub_total: 600, type: 'PAID', collect_at_pickup: 0 },
  ...o,
});

d('Online platformlar (gerçek HTTP, gerçek veritabanı)', () => {
  beforeAll(async () => {
    testSql('DELETE FROM online_orders; DELETE FROM online_webhook_log; UPDATE online_platforms SET is_enabled=0, webhook_secret="", credentials_json="{}", token_cache=NULL, token_expires_at=NULL, last_webhook_at=NULL;');
    resetThrottle();
    mock = spawn(findPhp(), ['-S', '127.0.0.1:8090', path.resolve('tests/helpers/mockPlatform.php')], { stdio: 'ignore' });
    for (let i = 0; i < 40; i++) { try { await mockReset(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  });
  afterAll(() => { mock?.kill(); });

  it('yalnızca Trendyol Go Yemek ve Yemeksepeti vardır (Getir kaldırıldı)', async () => {
    const r = await call('get_online_platforms', { kasa: true });
    expect(r.data.platforms.map((p: any) => p.platform_code).sort()).toEqual(['TRENDYOL', 'YEMEKSEPETI']);
    expect((await saveCfg('GETIR', { credentials: {} })).status).toBe(400);
  });

  /* ============================== TRENDYOL ============================== */
  describe('Trendyol Go Yemek', () => {
    it('eksik bilgi (e-posta yok) açıkça söylenir ve platforma istek ATILMAZ', async () => {
      await mockReset();
      const r = await act('test_online_connection', { platform: 'TRENDYOL', credentials: { ...TY, email: '' } });
      expect(r.data.success).toBe(false);
      expect(r.data.message).toMatch(/Trendyol e-posta/);
      expect((await mockCalls()).length).toBe(0);
    });

    it('yanlış secret: platformun 401 yanıtı gösterilir, başarılı denmez', async () => {
      const r = await act('test_online_connection', { platform: 'TRENDYOL', credentials: { ...TY, secretKey: 'YANLIS' } });
      expect(r.data.success).toBe(false);
      expect(r.data.message).toMatch(/401/);
    });

    it('doğru bilgiler: restoran listesi okunur; zorunlu başlıklar (UA, x-agentname, x-executor-user, Basic) gönderilir; mağaza kimliği öğrenilir', async () => {
      await mockReset();
      const r = await act('test_online_connection', { platform: 'TRENDYOL', credentials: TY });
      expect(r.data.success).toBe(true);
      expect(r.data.message).toMatch(/1 restoran/);
      expect(r.data.message).toContain('Taha Usta Şube');
      const c = (await mockCalls())[0];
      expect(c.path).toBe('/integrator/store/meal/suppliers/100200/stores');
      expect(c.headers['user-agent']).toBe('100200 - SelfIntegration');
      expect(c.headers['x-executor-user']).toBe('restoran@ornek.test');
      expect(c.headers['x-agentname']).toBeTruthy();
      expect(c.headers.authorization).toBe('Basic ' + Buffer.from('TYKEY:TYSEC').toString('base64'));
    });

    it('kaydedilmemiş ekrandaki bilgiler de test edilir; kayıt sonrası aktif edilir', async () => {
      await saveCfg('TRENDYOL', { credentials: TY, isEnabled: true });
      expect(JSON.parse(rows("SELECT credentials_json FROM online_platforms WHERE platform_code='TRENDYOL'")).apiKey).toBe('TYKEY');
    });

    it('SİPARİŞ ÇEKME: kasa listeyi isteyince platform sorgulanır; Model 1/Model 2/GetirYemek ayrıştırılır', async () => {
      await mockReset(); resetThrottle();
      await mockCfg({ packages: [
        tyPackage('PK1'),
        tyPackage('PK2', { deliveryType: 'GO', address: { firstName: 'Oms', address1: 'TGO Yemek', phone: '0212 999 88 77', pinCode: '55556666' }, totalPrice: 100, lines: [{ price: 100, items: [{ packageItemId: 'x1', isCancelled: false }], name: 'Pide', modifierProducts: [] }] }),
        tyPackage('PK3', { appName: 'Galaxy' }),
      ] });
      const list = await listOrders('ACTIVE'); // liste isteği platformu sorgular
      expect(list.orders).toHaveLength(3);
      const o1 = list.orders.find((x: any) => x.platformOrderId === 'PK1');
      expect(o1.customerName).toBe('Ayşe Yılmaz');
      expect(o1.address).toContain('Atatürk Cad. No:5');
      expect(o1.address).toContain('Kat: 3');
      expect(o1.address).not.toContain('TGO Yemek');
      expect(o1.customerPhone).toBe('0212 111 22 33');
      expect(o1.totalAmount).toBe(602.7);
      expect(o1.displayCode).toBe('4D5AC');
      expect(o1.sourceApp).toBe('TRENDYOL');
      expect(o1.deliveryModel).toBe('RESTAURANT_COURIER');
      expect(o1.paymentMethod).toBe('Online Kart (Ödendi)');
      expect(o1.orderNote).toContain('Acısız olsun');
      expect(o1.orderNote).toContain('12345678'); // IVR kodu müşteri aramak için
      // satır 1: 2 adet, birim = 145 + 10 (modifier) ; satır 2: yalnızca iptal edilmemiş 1 adet
      expect(o1.items).toHaveLength(2);
      expect(o1.items[0]).toMatchObject({ name: 'Adana Kebap Menü', quantity: 2, price: 155 });
      expect(o1.items[0].options.join(' ')).toContain('Ayran (küçük)');
      expect(o1.items[0].note).toContain('Ekstra: Ekstra Acı');
      expect(o1.items[0].note).toContain('Çıkar: Soğan');
      expect(o1.items[1]).toMatchObject({ name: 'Lahmacun', quantity: 1, price: 75 });
      const o2 = list.orders.find((x: any) => x.platformOrderId === 'PK2');
      expect(o2.deliveryModel).toBe('PLATFORM_COURIER');
      expect(o2.address).toMatch(/Trendyol kuryesi/);
      expect(list.orders.find((x: any) => x.platformOrderId === 'PK3').sourceApp).toBe('GETIR'); // appName=Galaxy
      // yalnızca doğru sorgu: Created paketleri
      const gets = (await mockCalls()).filter((c) => c.method === 'GET' && c.path.endsWith('/packages'));
      expect(gets[0].query.packageStatuses).toBe('Created');
      expect(Number(gets[0].query.size)).toBeLessThanOrEqual(50);
    });

    it('aynı paket tekrar gelince çift kayıt oluşmaz; sorgu 20 sn içinde tekrarlanmaz', async () => {
      const before = (await mockCalls()).length;
      await listOrders('ACTIVE'); await listOrders('ACTIVE');
      expect((await mockCalls()).length).toBe(before); // sıklık sınırı
      resetThrottle();
      await forcePoll();
      expect(rows("SELECT COUNT(*) FROM online_orders WHERE platform_code='TRENDYOL'")).toBe('3');
    });

    it('KABUL: PUT /packages/picked {packageId, preparationTime}; yerel durum HAZIRLANIYOR; platform durumu Picking', async () => {
      await mockReset();
      await mockCfg({ packages: [tyPackage('PK1')] });
      const r = await act('accept_online_order', { orderId: 'PK1', platform: 'TRENDYOL', preparationTime: 30 });
      expect(r.data.success).toBe(true);
      expect(r.data.platformSync).toBe('OK');
      const put = (await mockCalls()).find((c) => c.method === 'PUT');
      expect(put.path).toBe('/integrator/order/meal/suppliers/100200/packages/picked');
      expect(put.body).toEqual({ packageId: 'PK1', preparationTime: 30 });
      expect((await mockState()).packages[0].packageStatus).toBe('Picking');
      expect(rows("SELECT local_status FROM online_orders WHERE platform_order_id='PK1'")).toBe('HAZIRLANIYOR');
    });

    it('YOLA ÇIKTI (kendi kurye): invoiced → manual-shipped; TESLİM: manual-delivered', async () => {
      await mockReset(); await mockCfg({ packages: [tyPackage('PK1', { packageStatus: 'Picking' })] });
      const r = await act('dispatch_online_order', { orderId: 'PK1', platform: 'TRENDYOL' });
      expect(r.data.platformSync).toBe('OK');
      const paths = (await mockCalls()).filter((c) => c.method === 'PUT').map((c) => c.path.replace('/integrator/order/meal/suppliers/100200', ''));
      expect(paths).toEqual(['/packages/invoiced', '/packages/PK1/manual-shipped']);
      const inv = (await mockCalls()).find((c) => c.path.endsWith('/invoiced'));
      expect(typeof inv.body.actualDate).toBe('number'); // epoch ms
      await mockReset(); await mockCfg({ packages: [tyPackage('PK1', { packageStatus: 'Shipped' })] });
      const dv = await act('deliver_online_order', { orderId: 'PK1', platform: 'TRENDYOL' });
      expect(dv.data.platformSync).toBe('OK');
      expect((await mockCalls()).find((c) => c.method === 'PUT').path).toMatch(/\/packages\/PK1\/manual-delivered$/);
      expect(rows("SELECT local_status FROM online_orders WHERE platform_order_id='PK1'")).toBe('TESLIM_EDILDI');
    });

    it('Trendyol kuryesi (Model 2): yalnızca invoiced; manual-shipped/delivered ÇAĞRILMAZ', async () => {
      await mockReset(); await mockCfg({ packages: [tyPackage('PK2', { deliveryType: 'GO' })] });
      const r = await act('dispatch_online_order', { orderId: 'PK2', platform: 'TRENDYOL' });
      expect(r.data.platformSync).toBe('OK');
      expect(r.data.platformSyncMessage).toMatch(/Trendyol kuryesi/);
      const puts = (await mockCalls()).filter((c) => c.method === 'PUT');
      expect(puts.map((c) => c.path.split('/').pop())).toEqual(['invoiced']);
      await mockReset();
      const dv = await act('deliver_online_order', { orderId: 'PK2', platform: 'TRENDYOL' });
      expect(dv.data.platformSync).toBe('OK');
      expect((await mockCalls()).filter((c) => c.method === 'PUT')).toHaveLength(0);
    });

    it('İPTAL: unsupplied + iptal edilmemiş TÜM kalem kimlikleri + resmi neden kimliği; Model 2 için 624/626 → 623', async () => {
      await mockReset(); await mockCfg({ packages: [tyPackage('PK1'), tyPackage('PK2', { deliveryType: 'GO' })] });
      resetThrottle(); await forcePoll();
      const r = await act('reject_online_order', { orderId: 'PK1', platform: 'TRENDYOL', reasonId: 622, cancelReason: 'Mağaza kapalı' });
      expect(r.data.platformSync).toBe('OK');
      const put = (await mockCalls()).find((c) => c.path.endsWith('/unsupplied'));
      expect(put.body.packageId).toBe('PK1');
      expect(put.body.itemIdList.sort()).toEqual(['pi1', 'pi2', 'pi3']); // pi4 zaten iptal
      expect(put.body.reasonId).toBe(622);
      await mockReset(); await mockCfg({ packages: [tyPackage('PK2', { deliveryType: 'GO' })] });
      await act('reject_online_order', { orderId: 'PK2', platform: 'TRENDYOL', reasonId: 624 });
      expect((await mockCalls()).find((c) => c.path.endsWith('/unsupplied')).body.reasonId).toBe(623);
    });

    it('platform tarafında iptal (müşteri) sonraki sorguda yerel IPTAL olur', async () => {
      await mockReset(); resetThrottle();
      await mockCfg({ packages: [tyPackage('PK9')] });
      await forcePoll();
      expect(rows("SELECT local_status FROM online_orders WHERE platform_order_id='PK9'")).toBe('BEKLIYOR');
      await mockCfg({ packages: [tyPackage('PK9', { packageStatus: 'Cancelled', packageModificationDate: nowMs() + 5 })] });
      resetThrottle(); await forcePoll();
      expect(rows("SELECT local_status FROM online_orders WHERE platform_order_id='PK9'")).toBe('IPTAL');
    });

    it('Trendyol/Uber siparişi başka yerden (panel) kabul edilirse yerel durum ileri alınır, geri alınmaz', async () => {
      await mockReset(); resetThrottle();
      await mockCfg({ packages: [tyPackage('PKA')] });
      await forcePoll();
      await mockCfg({ packages: [tyPackage('PKA', { packageStatus: 'Picking', packageModificationDate: nowMs() + 5 })] });
      resetThrottle(); await forcePoll();
      expect(rows("SELECT local_status FROM online_orders WHERE platform_order_id='PKA'")).toBe('HAZIRLANIYOR');
    });

    it('mağaza durumu: Kapalı → PUT stores/{id}/status CLOSED; Yoğun → Trendyol\'da yok, dürüstçe MANUEL', async () => {
      await mockReset();
      const r = await act('update_online_store_status', { platform: 'TRENDYOL', status: 'CLOSED' });
      expect(r.data.results[0].sync).toBe('OK');
      const put = (await mockCalls()).find((c) => c.method === 'PUT');
      expect(put.path).toBe('/integrator/store/meal/suppliers/100200/stores/153/status');
      expect(put.body).toEqual({ status: 'CLOSED' });
      const busy = await act('update_online_store_status', { platform: 'TRENDYOL', status: 'BUSY' });
      expect(busy.data.results[0].sync).toBe('MANUAL');
      await act('update_online_store_status', { platform: 'TRENDYOL', status: 'OPEN' });
    });

    it('platform hata verirse "başarılı" DENMEZ (FAILED + neden)', async () => {
      await mockReset(); await mockCfg({ packages: [tyPackage('PKF')], fail: true });
      resetThrottle();
      const r = await act('accept_online_order', { orderId: 'PKA', platform: 'TRENDYOL', preparationTime: 20 });
      expect(r.data.platformSync).toBe('FAILED');
      expect(r.data.platformSyncMessage).toMatch(/500/);
      await mockCfg({ fail: false });
    });

    it('sorgu hatası tanı ekranında görünür (lastPollError)', async () => {
      await mockReset(); await mockCfg({ fail: true }); resetThrottle();
      await forcePoll();
      const t = (await diag()).platforms.find((p: any) => p.platform === 'TRENDYOL');
      expect(t.lastPollError).toMatch(/500/);
      await mockCfg({ fail: false }); resetThrottle(); await forcePoll();
      expect((await diag()).platforms.find((p: any) => p.platform === 'TRENDYOL').lastPollError).toBeNull();
    });
  });

  /* ============================== YEMEKSEPETİ ============================== */
  describe('Yemeksepeti Partner API', () => {
    const SECRET = 'ys-webhook-statik-token-123';
    beforeAll(async () => { await mockReset(); });

    it('Client ID/Secret eksikse açıkça söylenir', async () => {
      const r = await act('test_online_connection', { platform: 'YEMEKSEPETI', credentials: { clientId: '', clientSecret: '' } });
      expect(r.data.success).toBe(false);
      expect(r.data.message).toMatch(/Client ID/);
    });

    it('yanlış secret reddedilir; doğru bilgilerle OAuth ve restoran durumu doğrulanır', async () => {
      const bad = await act('test_online_connection', { platform: 'YEMEKSEPETI', credentials: { ...YS, clientSecret: 'x' } });
      expect(bad.data.success).toBe(false);
      expect(bad.data.message).toMatch(/401/);
      await mockReset();
      const ok = await act('test_online_connection', { platform: 'YEMEKSEPETI', credentials: YS });
      expect(ok.data.success).toBe(true);
      expect(ok.data.message).toMatch(/Restoran durumu okundu: OPEN/);
      const tokenCall = (await mockCalls()).find((c) => c.path === '/v2/oauth/token');
      expect(tokenCall.headers['content-type']).toMatch(/x-www-form-urlencoded/);
      expect(tokenCall.body).toContain('grant_type=client_credentials');
    });

    it('Chain/Vendor ID yoksa test bunu açıkça belirtir (kimlik doğrulansa bile)', async () => {
      const r = await act('test_online_connection', { platform: 'YEMEKSEPETI', credentials: { clientId: 'YS-ID', clientSecret: 'YS-SECRET', apiBaseUrl: MOCK } });
      expect(r.data.success).toBe(true);
      expect(r.data.message).toMatch(/Chain ID ve Vendor ID/);
    });

    it('webhook: anahtar yoksa 403, yanlışsa 401 (neden günlükte); doğruysa sipariş kaydedilir, maskeli müşteri verisi uydurulmaz', async () => {
      await saveCfg('YEMEKSEPETI', { credentials: { clientId: 'YS-ID', clientSecret: 'YS-SECRET', apiBaseUrl: MOCK }, isEnabled: true });
      expect((await hook('YEMEKSEPETI', ysOrder('o-0'), { authorization: SECRET })).status).toBe(403);
      await saveCfg('YEMEKSEPETI', { credentials: { clientId: 'YS-ID', clientSecret: 'YS-SECRET', apiBaseUrl: MOCK }, webhookSecret: SECRET, isEnabled: true });
      expect((await hook('YEMEKSEPETI', ysOrder('o-0'), { authorization: 'yanlis' })).status).toBe(401);
      const dg = await diag();
      expect(JSON.stringify(dg)).not.toContain(SECRET);
      const ok = await hook('YEMEKSEPETI', ysOrder('o-1'), { authorization: SECRET });
      expect(ok.status).toBe(200);
      const o = (await listOrders('ACTIVE')).orders.find((x: any) => x.platformOrderId === 'o-1');
      expect(o.customerName).toBe('Yemeksepeti Müşterisi'); // *** maskesi uydurma ada çevrilmez
      expect(o.customerPhone).toBe('');
      expect(o.address).toContain('Gaziantep');
      expect(o.address).toContain('Evergr******'); // kısmen maskeli alan platformun verdiği haliyle gösterilir
      expect(o.address).not.toMatch(/Building: \*+/i); // tamamen maskeli alan atılır
      expect(o.items[0]).toMatchObject({ name: 'Adana Kebap', quantity: 2, price: 280, note: 'Acılı' });
      expect(o.totalAmount).toBe(600);
      expect(o.paymentMethod).toBe('Online (Ödendi)');
      expect(o.deliveryModel).toBe('PLATFORM_COURIER');
      expect(o.displayCode).toBe('abcd-1234');
      expect(o.orderNote).toContain('Zili çalmayın');
    });

    it('webhook tekrarında çift kayıt yok; siparişten Chain ID / Vendor ID otomatik öğrenilir', async () => {
      const again = await hook('YEMEKSEPETI', ysOrder('o-1'), { authorization: SECRET });
      expect((await again.json() as any).duplicate).toBe(true);
      expect(rows("SELECT COUNT(*) FROM online_orders WHERE platform_order_id='o-1'")).toBe('1');
      const creds = JSON.parse(rows("SELECT credentials_json FROM online_platforms WHERE platform_code='YEMEKSEPETI'"));
      expect(creds.chainId).toBe('chain-1');
      expect(creds.vendorId).toBe('naez');
    });

    it('webhook durum bildirimleri: READY_FOR_PICKUP ileri alır, CANCELLED iptal eder', async () => {
      await hook('YEMEKSEPETI', ysOrder('o-1', { status: 'READY_FOR_PICKUP' }), { authorization: SECRET });
      expect(rows("SELECT local_status FROM online_orders WHERE platform_order_id='o-1'")).toBe('YOLA_CIKTI');
      await hook('YEMEKSEPETI', ysOrder('o-2'), { authorization: SECRET });
      await hook('YEMEKSEPETI', ysOrder('o-2', { status: 'CANCELLED', cancellation: { cancelled_by: 'CUSTOMER', reason: 'ITEM_UNAVAILABLE' } }), { authorization: SECRET });
      expect(rows("SELECT local_status FROM online_orders WHERE platform_order_id='o-2'")).toBe('IPTAL');
    });

    it('SİPARİŞ ÇEKME (webhook olmadan): vendor orders uçundan RECEIVED siparişler gelir; token önbelleğe alınır', async () => {
      await mockReset(); resetThrottle();
      testSql("UPDATE online_platforms SET token_cache=NULL, token_expires_at=NULL WHERE platform_code='YEMEKSEPETI'");
      await mockCfg({ ysOrders: [ysOrder('p-1'), ysOrder('p-2', { transport_type: 'VENDOR_DELIVERY' })] });
      await forcePoll();
      const o = (await listOrders('ACTIVE')).orders;
      expect(o.find((x: any) => x.platformOrderId === 'p-1')).toBeTruthy();
      expect(o.find((x: any) => x.platformOrderId === 'p-2').deliveryModel).toBe('RESTAURANT_COURIER');
      resetThrottle(); await forcePoll();
      const tokenCalls = (await mockCalls()).filter((c) => c.path === '/v2/oauth/token');
      expect(tokenCalls).toHaveLength(1); // ikinci sorguda yeniden giriş yok
      const get = (await mockCalls()).find((c) => c.path === '/v2/chains/chain-1/vendors/naez/orders');
      expect(get.headers.authorization).toBe('Bearer ys-tok');
      expect(get.query.start_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Number(get.query.page_size)).toBeLessThanOrEqual(500);
    });

    it('KABUL: Yemeksepeti\'nde ayrı adım yok → platforma istek atılmaz ve bu dürüstçe söylenir', async () => {
      await mockReset();
      const r = await act('accept_online_order', { orderId: 'p-1', platform: 'YEMEKSEPETI' });
      expect(r.data.platformSync).toBe('OK');
      expect(r.data.platformSyncMessage).toMatch(/ayrı bir 'kabul'/);
      expect((await mockCalls()).filter((c) => c.path.startsWith('/v2/chains'))).toHaveLength(0);
    });

    it('HAZIR/YOLA ÇIKTI: Yemeksepeti kuryesi → READY_FOR_PICKUP; kendi kuryen → DISPATCHED (PUT /orders/{id})', async () => {
      await mockReset(); await mockCfg({ ysOrders: [ysOrder('p-1'), ysOrder('p-2', { transport_type: 'VENDOR_DELIVERY' })] });
      const a = await act('dispatch_online_order', { orderId: 'p-1', platform: 'YEMEKSEPETI' });
      expect(a.data.platformSync).toBe('OK');
      let put = (await mockCalls()).find((c) => c.method === 'PUT');
      expect(put.path).toBe('/v2/chains/chain-1/orders/p-1');
      expect(put.body.status).toBe('READY_FOR_PICKUP');
      expect(put.body.order_id).toBe('p-1');
      await mockReset(); await mockCfg({ ysOrders: [ysOrder('p-2', { transport_type: 'VENDOR_DELIVERY' })] });
      await act('dispatch_online_order', { orderId: 'p-2', platform: 'YEMEKSEPETI' });
      put = (await mockCalls()).find((c) => c.method === 'PUT');
      expect(put.body.status).toBe('DISPATCHED');
    });

    it('İPTAL: status CANCELLED + cancellation.reason; platform hatası FAILED olarak bildirilir', async () => {
      await mockReset(); await mockCfg({ ysOrders: [ysOrder('p-1')] });
      const r = await act('reject_online_order', { orderId: 'p-1', platform: 'YEMEKSEPETI', cancelReason: 'Ürün tükendi' });
      expect(r.data.platformSync).toBe('OK');
      const put = (await mockCalls()).find((c) => c.method === 'PUT');
      expect(put.body.status).toBe('CANCELLED');
      expect(put.body.cancellation.reason).toBeTruthy();
      await mockReset(); await mockCfg({ fail: true });
      testSql("UPDATE online_orders SET local_status='BEKLIYOR' WHERE platform_order_id='p-2'");
      const bad = await act('reject_online_order', { orderId: 'p-2', platform: 'YEMEKSEPETI' });
      expect(bad.data.platformSync).toBe('FAILED');
      await mockCfg({ fail: false });
    });

    it('mağaza durumu: Açık → OPEN; Kapalı → CLOSED_TODAY; Yoğun → CLOSED_UNTIL (+kapanış zamanı, neden)', async () => {
      await mockReset();
      await act('update_online_store_status', { platform: 'YEMEKSEPETI', status: 'CLOSED' });
      let put = (await mockCalls()).filter((c) => c.method === 'PUT').pop();
      expect(put.path).toBe('/v2/chains/chain-1/vendors/naez/status');
      expect(put.body.status).toBe('CLOSED_TODAY');
      await act('update_online_store_status', { platform: 'YEMEKSEPETI', status: 'BUSY' });
      put = (await mockCalls()).filter((c) => c.method === 'PUT').pop();
      expect(put.body.status).toBe('CLOSED_UNTIL');
      expect(put.body.closed_reason).toBe('TOO_BUSY_KITCHEN');
      expect(put.body.closed_until).toMatch(/Z$/);
      await act('update_online_store_status', { platform: 'YEMEKSEPETI', status: 'OPEN' });
      expect((await mockState()).ysStatus).toBe('OPEN');
    });
  });

  it('işlem uçları kasa anahtarı olmadan çalışmaz', async () => {
    for (const a of ['accept_online_order', 'reject_online_order', 'test_online_connection', 'poll_online_orders', 'get_online_diagnostics', 'save_online_platform_config']) {
      expect((await call(a, { body: { orderId: 'x', platform: 'TRENDYOL' } })).status, a).toBe(401);
    }
  });

  it('GetirYemek eski adresi (platform=GETIR) Trendyol olarak ele alınır (siparişler Trendyol üzerinden gelir)', async () => {
    testSql("UPDATE online_platforms SET webhook_secret='ty-webhook-secret-123' WHERE platform_code='TRENDYOL'");
    const r = await hook('GETIR', tyPackage('PKG-G', { appName: 'Galaxy' }), { 'x-api-key': 'ty-webhook-secret-123' });
    expect(r.status).toBe(200);
    expect(rows("SELECT source_app FROM online_orders WHERE platform_order_id='PKG-G'")).toBe('GETIR');
  });
});
