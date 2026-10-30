// UÇTAN UCA: garson PWA yeni sürüm yayını. Gerçek (başsız) Edge + kendi PHP sunucusunda (port 8081) KOPYA bir site.
// Doğrulanan: yeni sürüm "bekleyen" olur; garsona bildirim çıkar; sepet doluyken UYGULANMAZ (sayfa yenilenmez);
// sepet boşken uygulanır; eski önbellek silinir, yeni önbellek kurulur; oturum (giriş) korunur.
const { spawn, execFileSync } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require(path.resolve(__dirname, '../../node_modules/ws'));

const edge = process.env.BROWSER_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const phpDir = path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages');
function findPhp() {
  const walk = (d, depth) => {
    if (depth > 3 || !fs.existsSync(d)) return null;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isFile() && e.name === 'php.exe') return p;
      if (e.isDirectory() && (depth > 0 || /^PHP\.PHP/.test(e.name))) { const r = walk(p, depth + 1); if (r) return r; }
    }
    return null;
  };
  return process.env.PHP_BIN || walk(phpDir, 0);
}
const php = findPhp();
if (!php) { console.error('php.exe bulunamadı (PHP_BIN verin)'); process.exit(2); }

const stamp = Date.now();
const site = `C:/dev-test/pwa-site-${stamp}`;
fs.cpSync(path.resolve(__dirname, '../../cpanel-yuklenecekler'), site, { recursive: true });
const swFile = `${site}/garson/sw.js`, verFile = `${site}/garson/version.json`;
const SITE_PORT = 8093, CDP = 9556;
const profile = `C:/dev-test/pwa-upd-profile-${stamp}`;
const url = `http://127.0.0.1:${SITE_PORT}/garson/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((ok, no) => http.get(u, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => ok(JSON.parse(b))); }).on('error', no));

(async () => {
  const srv = spawn(php, ['-S', `127.0.0.1:${SITE_PORT}`, '-t', site], { stdio: 'ignore' });
  await sleep(1500); // PHP sunucusu açılsın
  const proc = spawn(edge, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  const cleanup = () => { try { proc.kill(); srv.kill(); } catch {} };
  try {
    let tabs;
    for (let i = 0; i < 30; i++) { try { tabs = await getJson(`http://127.0.0.1:${CDP}/json`); if (tabs.find((t) => t.type === 'page')) break; } catch {} await sleep(500); }
    const page = tabs.find((t) => t.type === 'page');
    console.log('tarayıcı hazır, php=' + php);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.on('open', r));
    let id = 0; const pending = new Map();
    ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } });
    const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.result.value ?? r.result.exceptionDetails?.exception?.description; };
    const results = [];
    const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'GEÇTİ  ' : 'KALDI  ') + name + (extra ? '  → ' + extra : '')); };
    await send('Page.enable'); await send('Runtime.enable');

    await send('Page.navigate', { url });
    await sleep(4000);
    console.log('sayfa açıldı: ' + (await ev('document.title')) + '; SW bekleniyor');
    await ev(`Promise.race([navigator.serviceWorker.ready.then(()=>1), new Promise(r=>setTimeout(()=>r('zaman aşımı'),8000))])`);
    await send('Page.reload'); // ilk yüklemeden sonra sayfa SW tarafından kontrol edilsin
    await sleep(3500);
    const ctl = await ev(`!!navigator.serviceWorker.controller`);
    check('sayfa servis çalışanı tarafından kontrol ediliyor', ctl === true);
    check('v1.1.0 önbelleği kurulu', (await ev(`caches.keys().then(k=>k.join(','))`)).includes('garson-v1.1.0'));
    await ev(`window.__marker='ilk-sayfa'; localStorage.setItem('gtu_session_v2', JSON.stringify({token:'t.t',waiter:{id:'w',name:'Ali'},exp:Date.now()+3600000})); 1`);

    // ---- YENİ SÜRÜM YAYINLA (sunucudaki dosyalar değişir) ----
    fs.writeFileSync(swFile, fs.readFileSync(swFile, 'utf8').replace("'garson-v1.1.0'", "'garson-v9.9.9'"));
    fs.writeFileSync(verFile, '{"version":"9.9.9"}\n');
    await ev(`navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>1)`);
    await sleep(2500);

    const waiting = await ev(`navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)`);
    check('yeni sürüm ARKA PLANDA indirildi ve bekliyor (hemen devreye girmedi)', waiting === true);
    check('eski sürüm önbelleği henüz silinmedi (eski/yeni karışmıyor)', (await ev(`caches.keys().then(k=>k.join(','))`)).includes('garson-v1.1.0'));
    const barVisible = await ev(`!document.getElementById('updateBar').classList.contains('hidden')`);
    check('garsona "yeni sürüm hazır" bildirimi gösterildi', barVisible === true, await ev(`document.getElementById('updateBarText').innerText`));

    // ---- sepet doluyken uygulama ----
    await ev(`cart.push({id:'x',productId:'p',productName:'Test',price:1,quantity:1,note:''}); document.getElementById('updateBarBtn').click(); 1`);
    await sleep(1500);
    check('sepet doluyken güncelleme UYGULANMADI, sayfa yenilenmedi', (await ev(`window.__marker`)) === 'ilk-sayfa');
    check('sepet korundu', (await ev(`cart.length`)) === 1);

    // ---- sepet boşken uygulama ----
    await ev(`cart.length = 0; document.getElementById('updateBarBtn').click(); 1`);
    await sleep(4000);
    check('sepet boşalınca güncelleme uygulandı (sayfa yenilendi)', (await ev(`window.__marker`)) === undefined);
    const keys = await ev(`caches.keys().then(k=>k.join(','))`);
    check('yeni önbellek kuruldu, eski silindi', keys.includes('garson-v9.9.9') && !keys.includes('garson-v1.1.0'), keys);
    check('oturum güncellemeden sonra da korundu', (await ev(`!!localStorage.getItem('gtu_session_v2')`)) === true);
    check('yeni sürümün dosyasını sunuyor (version.json)', (await ev(`fetch('./version.json',{cache:'no-store'}).then(r=>r.json()).then(j=>j.version)`)) === '9.9.9');

    ws.close(); cleanup();
    const pass = results.filter(Boolean).length;
    console.log(`\nSONUÇ: ${pass}/${results.length} kontrol geçti`);
    process.exit(pass === results.length ? 0 : 1);
  } catch (e) { cleanup(); console.error(e); process.exit(2); }
})();
