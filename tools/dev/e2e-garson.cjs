// UÇTAN UCA: gerçek garson sayfası (başsız Edge) + gerçek PHP/MySQL (izole TEST veritabanı) + kasa API'si.
// Senaryo: eşleştirme → PIN → sipariş → bağlantı kesilirse hata → aynı sepetle yeniden dene (çift kayıt yok)
//          → kasa siparişi çeker → onaylar. Gerçek veriye dokunmaz (taha_test, port 3307).
const { spawn, execFileSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const WebSocket = require(path.resolve(__dirname, '../../node_modules/ws'));

const BASE = 'http://127.0.0.1:8080';
const API = BASE + '/api/index.php';
const KASA = 'test-only-kasa-key-0123456789abcdef';
const edge = process.env.BROWSER_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const maria = 'C:/Program Files/MariaDB 13.0/bin/mariadb.exe';
const port = 9555;
const profile = 'C:/dev-test/e2e-profile-' + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execFileSync(maria, ['--protocol=tcp', '-h127.0.0.1', '-P3307', '-utaha_test', '-ptest_only_pw', 'taha_test', '-N', '-e', q], { encoding: 'utf8' }).trim();
const kasa = async (action, body) => {
  const r = await fetch(`${API}?action=${action}`, { method: body ? 'POST' : 'GET', headers: { 'X-Kasa-Key': KASA, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
};
const getJson = (u) => new Promise((ok, no) => http.get(u, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => ok(JSON.parse(b))); }).on('error', no));

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'GEÇTİ  ' : 'KALDI  ') + name + (extra ? '  → ' + extra : '')); };

(async () => {
  // --- hazırlık: yalnızca TEST veritabanı
  sql(`INSERT INTO personeller (id, ad, pin, rol, aktif) VALUES ('w-e2e','E2E Garson','2468','WAITER',1) ON DUPLICATE KEY UPDATE pin='2468', aktif=1, device_token_hash=NULL, pairing_secret=NULL, pairing_code_hash=NULL;
       DELETE FROM cihazlar WHERE waiter_id='w-e2e'; DELETE FROM rate_limits;
       INSERT INTO kategoriler (id, ad) VALUES ('k-e2e','E2E Kategori') ON DUPLICATE KEY UPDATE ad='E2E Kategori';
       INSERT INTO urunler (id, kategori_id, ad, fiyat, aktif) VALUES ('p-e2e','k-e2e','E2E Çorba',75,1) ON DUPLICATE KEY UPDATE fiyat=75, aktif=1, ad='E2E Çorba';
       UPDATE masalar SET durum='EMPTY', aktif_siparis=NULL, toplam_tutar=0 WHERE id='tbl-sec-salon-7';
       DELETE FROM siparisler WHERE masa_id='tbl-sec-salon-7';`);
  await kasa('get_live_state'); // şema hazır
  const rows = Array.from({ length: 30 }, (_, i) => `('tbl-sec-salon-${i + 1}','sec-salon','Ana Salon ${i + 1}','EMPTY')`).join(',');
  sql(`INSERT IGNORE INTO bolumler (id, ad, masa_sayisi, kapasite_kisi, sira) VALUES ('sec-salon','Ana Salon',30,4,1); INSERT IGNORE INTO masalar (id, bolum_id, ad, durum) VALUES ${rows};`);

  const pair = await kasa('create_pairing_token', { userId: 'w-e2e' });
  check('kasa 6 haneli eşleştirme kodu üretti', /^\d{6}$/.test(pair.pairingCode), pair.pairingCode);

  const proc = spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 30; i++) { try { tabs = await getJson(`http://127.0.0.1:${port}/json`); if (tabs.find((t) => t.type === 'page')) break; } catch {} await sleep(500); }
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } });
  const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'İSTİSNA: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable');

  await send('Page.navigate', { url: BASE + '/garson/' });
  await sleep(2500);

  // --- 1) eşleştirme (sayfanın kendi fonksiyonu)
  await ev(`(function(){var i=document.getElementById('inputPairingCode'); if(i){i.value='${pair.pairingCode}';} })()`);
  await ev(`submitPairingCode()`);
  await sleep(2500);
  const token = await ev(`localStorage.getItem('gtu_device_token') || ''`);
  check('garson cihazı eşleşti, cihaz anahtarı saklandı', /^[0-9a-f]{64}$/.test(token));
  const dbDevice = sql(`SELECT COUNT(*) FROM cihazlar WHERE waiter_id='w-e2e' AND durum='APPROVED'`);
  check('eşleşme sunucuda kayıtlı', dbDevice === '1');

  // --- 2) PIN ile giriş (keypad fonksiyonları)
  await ev(`enteredPin=''; ['2','4','6','8'].forEach(function(d){ pressKey(d); })`);
  await sleep(300);
  await ev(`submitPin()`);
  await sleep(2500);
  const mainVisible = await ev(`!document.getElementById('mainApp').classList.contains('hidden')`);
  check('PIN ile giriş yapıldı, ana ekran açıldı', mainVisible === true);
  const sess = await ev(`sessionStorage.getItem('gtu_session') || ''`);
  check('sunucu imzalı oturum verdi (PIN telefonda saklanmıyor)', sess.includes('.') && (await ev(`(function(){var bad=false;[localStorage,sessionStorage].forEach(function(st){for(var i=0;i<st.length;i++){var k=st.key(i),v=st.getItem(k)||''; if(v==='2468'||/"pin"\s*:\s*"?2468"?/.test(v)||/pin/i.test(k)&&v.indexOf('2468')>-1) bad=true;}});return bad})()`)) === false);

  // --- 3) sipariş hazırlama (gerçek sunucu verisiyle)
  await ev(`fetchLiveState()`);
  await sleep(2000);
  const counts = await ev(`JSON.stringify({tables: liveTables.length, products: liveProducts.length})`);
  check('masa ve menü sunucudan geldi (uydurma veri yok)', JSON.parse(counts).tables > 0 && JSON.parse(counts).products >= 1, counts);
  const hasDemo = await ev(`liveProducts.some(function(p){return /Adana Kebap/.test(p.name)})`);
  check('demo ürünler görünmüyor', hasDemo === false);

  await ev(`openOrderModal(liveTables.find(function(t){return t.id==='tbl-sec-salon-7'}))`);
  await sleep(500);
  await ev(`quickAddProductToCart(liveProducts.find(function(p){return p.id==='p-e2e'}))`);
  await ev(`quickAddProductToCart(liveProducts.find(function(p){return p.id==='p-e2e'}))`);
  check('sepette 2 adet', (await ev(`cart.reduce(function(s,i){return s+i.quantity},0)`)) === 2);

  // --- 4) bağlantı yokken gönder → HATA, sepet korunur
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await ev(`window.__seenToast=''; setInterval(function(){ var t=(document.getElementById('toastContainer')||{}).innerText||''; if(/GÖNDERİLEMEDİ/.test(t)) window.__seenToast=t; }, 100); 1`);
  await ev(`confirmAndSendKitchen()`);
  await sleep(5000);
  const toast = await ev(`window.__seenToast || ''`);
  check('bağlantı yokken "GÖNDERİLEMEDİ" uyarısı', /GÖNDERİLEMEDİ/.test(toast), toast.replace(/\n/g, ' ').slice(0, 90));
  check('hatada sepet korundu (2 adet)', (await ev(`cart.reduce(function(s,i){return s+i.quantity},0)`)) === 2);
  check('hatada sunucuya hiçbir sipariş yazılmadı', sql(`SELECT COUNT(*) FROM siparisler WHERE masa_id='tbl-sec-salon-7'`) === '0');

  // --- 5) bağlantı gelir → aynı sepet yeniden gönderilir
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const idBefore = await ev(`window.__pendingOrder && window.__pendingOrder.clientOrderId`);
  await ev(`confirmAndSendKitchen()`);
  await sleep(3500);
  check('yeniden gönderimde aynı işlem kimliği kullanıldı', !!idBefore && sql(`SELECT COUNT(*) FROM siparisler WHERE id='ord-${idBefore}'`) === '1', String(idBefore));
  check('sunucuda TEK sipariş kaydı, tutar sunucu fiyatıyla (2 x 75 = 150)', sql(`SELECT COUNT(*), SUM(toplam_tutar) FROM siparisler WHERE masa_id='tbl-sec-salon-7'`) === '1\t150.00');
  check('garson adı sunucu kimliğinden (E2E Garson)', sql(`SELECT garson_adi FROM siparisler WHERE masa_id='tbl-sec-salon-7'`) === 'E2E Garson');

  // --- 6) çift tıklama / ağ yanıtı kaybı benzetimi: aynı kimlikle 2. istek
  const dupe = await ev(`(async function(){
    var r = await apiFetch('send_order', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({clientOrderId:'${idBefore}', tableId:'tbl-sec-salon-7', tableName:'x', items:[{productId:'p-e2e',quantity:2,portion:1,price:1}]})});
    var d = await r.json(); return JSON.stringify({ok:d.success, dup:d.duplicate});
  })()`);
  check('aynı kimlikle tekrar istek "tekrar" olarak tanındı', JSON.parse(dupe).dup === true, dupe);
  check('tekrardan sonra hâlâ tek kayıt, masa toplamı 150', sql(`SELECT COUNT(*) FROM siparisler WHERE masa_id='tbl-sec-salon-7'`) === '1' && sql(`SELECT toplam_tutar FROM masalar WHERE id='tbl-sec-salon-7'`) === '150.00');

  // --- 7) kasa tarafı: çek → ürün kalemleri geldi → onayla
  const pulled = await kasa('pull_pending_orders');
  const mine = pulled.orders.find((o) => o.tableId === 'tbl-sec-salon-7');
  check('kasa siparişi gördü, kalemleri dolu', !!mine && mine.items.length === 1 && mine.items[0].quantity === 2);
  const again = await kasa('pull_pending_orders');
  check('onaydan önce sipariş kaybolmadı (tekrar çekilebilir)', again.orders.some((o) => o.id === mine.id));
  await kasa('ack_orders', { ids: [mine.id] });
  const after = await kasa('pull_pending_orders');
  check('onaydan sonra kuyruktan çıktı', !after.orders.some((o) => o.id === mine.id));

  // --- 8) cihaz yetkisi kasadan iptal edilince telefon düşer
  await kasa('reset_device_pairing', { userId: 'w-e2e' });
  const live = await ev(`(async function(){ var r = await apiFetch('get_live_state'); return r.status })()`);
  check('kasa cihazı iptal edince telefon yetkisini kaybetti (401)', live === 401, String(live));

  ws.close(); proc.kill();
  const pass = results.filter(Boolean).length;
  console.log(`\nSONUÇ: ${pass}/${results.length} kontrol geçti`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
