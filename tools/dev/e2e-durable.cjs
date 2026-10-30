// UÇTAN UCA: kalıcı depo (SQLite) — gerçek Electron, izole profil. Çökme, geçiş ve kurtarma senaryoları.
const { spawn, execSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const WebSocket = require(path.resolve(__dirname, '../../node_modules/ws'));

const root = path.resolve(__dirname, '../..');
const electron = process.env.GTU_EXE || path.join(root, 'node_modules/electron/dist/electron.exe');
const port = 9888;
const profile = 'C:/dev-test/e2e-durable-' + Date.now();
const backups = profile + '-yedek';
const dbFile = path.join(profile, 'data', 'kasa.db');
fs.mkdirSync(profile, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((ok, no) => http.get(u, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => ok(JSON.parse(b))); }).on('error', no));
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'GEÇTİ  ' : 'KALDI  ') + name + (extra ? '  → ' + extra : '')); };

let proc, ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'İSTİSNA: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };

async function launch() {
  const env = { ...process.env, GTU_BACKUP_DIR: backups };
  delete env.ELECTRON_RUN_AS_NODE;
  proc = spawn(electron, process.env.GTU_EXE ? [`--user-data-dir=${profile}`, `--remote-debugging-port=${port}`] : ['.', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { cwd: root, env, stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 40; i++) { try { tabs = await getJson(`http://127.0.0.1:${port}/json`); if (tabs.find((t) => t.type === 'page' && t.url.startsWith('file:'))) break; } catch {} await sleep(500); }
  const page = tabs.find((t) => t.type === 'page' && t.url.startsWith('file:'));
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } });
  await send('Runtime.enable');
  await sleep(2500);
}
const killHard = async () => { try { ws.close(); } catch {} try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch {} await sleep(2000); };
const readDb = () => { const db = new DatabaseSync(dbFile, { readOnly: true }); const rows = db.prepare('SELECT key, value FROM kv').all(); db.close(); return Object.fromEntries(rows.map((r) => [r.key, r.value])); };

(async () => {
  // ---- 1) Temiz başlangıç: depo oluştu
  await launch();
  check('SQLite deposu oluştu (kasa.db)', fs.existsSync(dbFile));
  const info = await ev(`window.electronAPI.invoke('kv-info').then(r=>JSON.stringify({ok:r.success,wal:r.journalMode,integ:r.integrity}))`);
  check('depo sağlıklı: WAL, bütünlük ok', /"wal":"wal"/.test(info) && /"integ":"ok"/.test(info), info);

  // ---- 2) ÇÖKME: yaz, hemen zorla öldür
  await ev(`localStorage.setItem('gtu_pos_completed_orders', JSON.stringify([{id:'COKME-1',totalAmount:111},{id:'COKME-2',totalAmount:222}])); localStorage.setItem('gtu_erp_customers', JSON.stringify([{id:'c1',balance:777}])); 1`);
  await sleep(300); // yalnızca IPC'nin ana sürece ulaşması için (diske yazma beklenmez)
  await killHard();
  const afterKill = readDb();
  check('zorla öldürmeden sonra veri SQLite dosyasında (arayüz yeniden açılmadan)', afterKill['gtu_pos_completed_orders'] && JSON.parse(afterKill['gtu_pos_completed_orders']).length === 2);

  await launch();
  check('yeniden açılışta veri arayüzde (adisyonlar)', (await ev(`JSON.parse(localStorage.getItem('gtu_pos_completed_orders')||'[]').length`)) === 2);
  check('yeniden açılışta cari bakiye korunmuş', (await ev(`JSON.parse(localStorage.getItem('gtu_erp_customers')||'[]')[0]?.balance`)) === 777);

  // ---- 3) Silme de kalıcı
  await ev(`localStorage.removeItem('gtu_erp_customers'); 1`);
  await sleep(300); await killHard();
  check('silinen anahtar SQLite\'tan da silindi', readDb()['gtu_erp_customers'] === undefined);

  // ---- 4) CHROMIUM DEPOSU BOZULURSA/SİLİNİRSE veri SQLite'tan geri gelir
  const ls = path.join(profile, 'Local Storage');
  fs.rmSync(ls, { recursive: true, force: true });
  await launch();
  check('Chromium "Local Storage" klasörü silinse bile adisyonlar SQLite\'tan geri geldi', (await ev(`JSON.parse(localStorage.getItem('gtu_pos_completed_orders')||'[]').length`)) === 2);
  await killHard();

  // ---- 5) SQLite ASIL KAYNAK: dosyaya doğrudan yazılan veri arayüze yansır
  { const db = new DatabaseSync(dbFile); db.prepare('INSERT OR REPLACE INTO kv VALUES (?,?,?)').run('gtu_test_dogrudan', 'sqlite-den', Date.now()); db.close(); }
  await launch();
  check('SQLite\'a doğrudan yazılan kayıt arayüzde görünüyor (asıl kaynak SQLite)', (await ev(`localStorage.getItem('gtu_test_dogrudan')`)) === 'sqlite-den');
  await killHard();

  // ---- 6) ESKİ SÜRÜMDEN GEÇİŞ: yalnızca Chromium localStorage'ında veri var, SQLite yok
  // Eski sürüm simülasyonu: Chromium'un GERÇEK localStorage'ına yazılır (uygulama artık oraya yazmaz) ve diske inmesi beklenir.
  await launch();
  await ev(`window.__chromiumLocalStorage.setItem('gtu_pos_completed_orders', JSON.stringify([{id:'ESKI-1',totalAmount:1},{id:'ESKI-2',totalAmount:2},{id:'ESKI-3',totalAmount:3}])); window.__chromiumLocalStorage.setItem('gtu_erp_customers', JSON.stringify([{id:'ESKI-C',balance:42}])); 1`);
  await sleep(9000);
  await killHard();
  for (const f of ['kasa.db', 'kasa.db-wal', 'kasa.db-shm']) fs.rmSync(path.join(profile, 'data', f), { force: true });
  await launch();   // SQLite boş + Chromium'da eski veri → içe aktarılmalı
  const dbAfter = readDb();
  check('eski sürüm verisi (Chromium localStorage) SQLite deposuna içe aktarıldı', dbAfter['gtu_pos_completed_orders'] && JSON.parse(dbAfter['gtu_pos_completed_orders']).length === 3 && dbAfter['gtu_erp_customers'], Object.keys(dbAfter).length + ' kayıt');
  check('geçiş sonrası arayüz verisi aynı (3 adisyon, cari 42)', (await ev(`JSON.parse(localStorage.getItem('gtu_pos_completed_orders')||'[]').length`)) === 3 && (await ev(`JSON.parse(localStorage.getItem('gtu_erp_customers')||'[]')[0].balance`)) === 42);
  check('eski Chromium verisi geri dönüş için yerinde duruyor', (await ev(`window.__chromiumLocalStorage.getItem('gtu_erp_customers') !== null`)) === true);
  await killHard();

  // ---- 6b) KOTA YOK: Chromium'un ~5-10 MB sınırından büyük veri sorunsuz saklanır
  await launch();
  const big = await ev(`(function(){ try { localStorage.setItem('gtu_test_buyuk', 'x'.repeat(12*1024*1024)); return 'ok' } catch(e) { return 'HATA: '+e.name } })()`);
  check('12 MB değer kota hatası vermeden yazıldı', big === 'ok', String(big));
  await sleep(4000); await killHard();
  check('12 MB değer zorla kapatmadan sonra SQLite deposunda duruyor', (readDb()['gtu_test_buyuk'] || '').length === 12 * 1024 * 1024);

  // ---- 7) Yedek/geri yükleme SQLite'a da yansır
  await launch();
  await ev(`localStorage.removeItem('gtu_test_buyuk'); 1`);
  const restored = await ev(`(async()=>{
    const cur = {format:'gtu-full-backup',version:1,createdAt:new Date().toISOString(),appVersion:'t',counts:{},data:{gtu_pos_completed_orders: JSON.stringify([{id:'YEDEK-1',totalAmount:5}])}};
    // geri yükleme mantığını localStorage üzerinden uygular (yalnızca yedeklenebilir anahtarlar)
    Object.keys(localStorage).filter(k=>/^gtu/.test(k)).forEach(k=>localStorage.removeItem(k));
    Object.entries(cur.data).forEach(([k,v])=>localStorage.setItem(k,v));
    return 'ok'})()`);
  await sleep(400); await killHard();
  const dbR = readDb();
  check('geri yükleme sonrası SQLite içeriği de yedeğe eşit', restored === 'ok' && JSON.parse(dbR['gtu_pos_completed_orders']).length === 1 && JSON.parse(dbR['gtu_pos_completed_orders'])[0].id === 'YEDEK-1' && dbR['gtu_test_dogrudan'] === undefined);

  fs.rmSync(profile, { recursive: true, force: true });
  fs.rmSync(backups, { recursive: true, force: true });
  const pass = results.filter(Boolean).length;
  console.log(`\nSONUÇ: ${pass}/${results.length} kontrol geçti`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(async (e) => { console.error(e); try { await killHard(); } catch {} process.exit(2); });
