// UÇTAN UCA (Windows): GERÇEK kurulmuş kasa uygulaması + GERÇEK electron-updater + yerel HTTP yayın sunucusu.
// Gerçek işletme verisi KULLANILMAZ: ayrı --user-data-dir. Ön koşul (elle hazırlanır, bkz. docs/updates.md §Test):
//   C:\dev-test\gtu-app            : eski sürüm (örn. 1.1.0) sessiz kuruldu
//   C:\dev-test\feed-good\guncelleme: yeni sürüm yayını (tools/update-tools.cjs ile)
// Senaryolar: bozuk paket reddi · yeni sürüm indirme · açık adisyonda kurulum engeli · kurulum · veri korunumu · kurulum sonrası açılış
const { spawn, execFileSync } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require(path.resolve(__dirname, '../../node_modules/ws'));

const APP_DIR = process.env.GTU_TEST_APP_DIR || 'C:/dev-test/gtu-app';
const EXE = `${APP_DIR}/Gaziantepli Taha Usta.exe`;
const FEEDS = process.env.GTU_TEST_FEEDS || 'C:/dev-test';
const DATA = 'C:/dev-test/gtu-userdata-' + Date.now();
const FEED_PORT = 8095, CDP = 9570;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'GEÇTİ  ' : 'KALDI  ') + name + (extra ? '  → ' + extra : '')); };
const fileVersion = () => {
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Item '${EXE.replace(/\//g, '\\')}' -ErrorAction Stop).VersionInfo.ProductVersion`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; } // kurulum sırasında dosya kısa süre yok olabilir
};
const getJson = (u) => new Promise((ok, no) => http.get(u, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => ok(JSON.parse(b))); }).on('error', no));

// Aralık (Range) destekli basit statik sunucu (electron-updater fark indirmesi için)
function startFeedServer() {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      const f = path.join(FEEDS, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(path.resolve(FEEDS)) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end('yok'); }
      const size = fs.statSync(f).size; const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range); const s = Number(m[1]); const e = m[2] ? Number(m[2]) : size - 1;
        res.writeHead(206, { 'Content-Range': `bytes ${s}-${e}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 });
        return fs.createReadStream(f, { start: s, end: e }).pipe(res);
      }
      res.writeHead(200, { 'Content-Length': size, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(f).pipe(res);
    }).listen(FEED_PORT, '127.0.0.1', () => ok(srv));
  });
}

async function launch(feedPath) {
  const env = { ...process.env, GTU_UPDATE_URL: `http://127.0.0.1:${FEED_PORT}/${feedPath}/` };
  delete env.ELECTRON_RUN_AS_NODE; // bu değişken varsa Electron uygulama yerine Node gibi çalışır ("bad option")
  const proc = spawn(EXE, [`--user-data-dir=${DATA}`, `--remote-debugging-port=${CDP}`], { env, stdio: 'ignore' });
  let page;
  for (let i = 0; i < 60; i++) {
    try { const tabs = await getJson(`http://127.0.0.1:${CDP}/json`); page = tabs.find((t) => t.type === 'page' && t.url.startsWith('file:')); if (page) break; } catch {}
    await sleep(500);
  }
  if (!page) throw new Error('uygulama penceresi açılmadı');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } });
  const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.result?.value ?? r.result.exceptionDetails?.exception?.description; };
  await send('Runtime.enable');
  await sleep(2500);
  return { proc, ev, close: () => { try { ws.close(); } catch {} } };
}
const kill = async (app) => { app.close(); try { app.proc.kill(); } catch {} await sleep(2500); };
const status = (app) => app.ev(`window.electronAPI.invoke('update-status')`);
async function waitState(app, wanted, ms = 150000) {
  const t0 = Date.now(); let s;
  while (Date.now() - t0 < ms) { s = await status(app); if (s && wanted.includes(s.state)) return s; await sleep(1500); }
  return s;
}

(async () => {
  if (!fs.existsSync(EXE)) { console.error('Kurulu test uygulaması yok: ' + EXE); process.exit(2); }
  // Önceki denemelerden kalan indirme önbelleği testi yanıltmasın (aynı özetli paket "zaten indirildi" sayılır).
  fs.rmSync(path.join(process.env.LOCALAPPDATA || '', 'gaziantepli-taha-usta-updater'), { recursive: true, force: true });
  const before = fileVersion();
  console.log('Kurulu sürüm (güncelleme öncesi): ' + before);
  const feed = await startFeedServer();

  // ---------- 4) BOZUK PAKET ----------
  const bad = path.join(FEEDS, 'feed-bad/guncelleme');
  fs.rmSync(path.join(FEEDS, 'feed-bad'), { recursive: true, force: true });
  fs.cpSync(path.join(FEEDS, 'feed-good/guncelleme'), bad, { recursive: true });
  const exeName = fs.readdirSync(bad).find((f) => f.endsWith('.exe'));
  const buf = fs.readFileSync(path.join(bad, exeName)); buf[2_000_000] ^= 0xff; fs.writeFileSync(path.join(bad, exeName), buf); // tek bayt bozuk
  fs.rmSync(path.join(bad, exeName + '.blockmap'), { force: true }); // tam indirme zorlansın
  let app = await launch('feed-bad/guncelleme');
  const st0 = await status(app);
  check('uygulama açıldı, güncelleme sistemi etkin (paketli sürüm)', st0 && st0.state !== 'disabled', `${st0.state} · kaynak=${st0.feedSource}`);
  await app.ev(`window.electronAPI.invoke('update-check')`);
  const rej = await waitState(app, ['rejected', 'downloaded', 'error']);
  check('4) bozuk paket REDDEDİLDİ', rej && rej.state === 'rejected', JSON.stringify({ state: rej?.state, msg: rej?.message }));
  const inst = await app.ev(`window.electronAPI.invoke('update-install', {openOrders:0,paymentInProgress:false})`);
  check('4) reddedilen paket kurulamaz', inst && inst.ok === false, inst?.message);
  await kill(app);
  check('4) bozuk paketten sonra sürüm DEĞİŞMEDİ', fileVersion() === before, fileVersion());

  // ---------- 1/2) GEÇERLİ YENİ SÜRÜM ----------
  app = await launch('feed-good/guncelleme');
  await app.ev(`window.electronAPI.invoke('kv-set', {key:'e2e_isletme_verisi', value:'korunmali-' + 12345})`);
  await app.ev(`window.electronAPI.invoke('update-check')`);
  const dl = await waitState(app, ['downloaded', 'rejected', 'error']);
  check('2) yeni sürüm bulundu, indirildi ve doğrulandı', dl && dl.state === 'downloaded', `${dl?.state} ${dl?.available || ''} ${dl?.message || ''}`);
  check('2) sürüm notları geldi', /Deneme sürümü/.test(dl?.notes || ''), dl?.notes);
  check('2) normal güncelleme olarak sınıflandı (zorla değil)', dl?.kind === 'normal');

  // ---------- 5) AÇIK ADİSYON VARKEN KURULUM ENGELLENİR ----------
  const refuse = await app.ev(`window.electronAPI.invoke('update-install', {openOrders:2,paymentInProgress:false})`);
  check('açık adisyon varken kurulum REDDEDİLDİ (zorla yeniden başlatma yok)', refuse && refuse.ok === false && /adisyon/.test(refuse.message), refuse?.message);
  check('uygulama hâlâ çalışıyor', (await status(app))?.state === 'downloaded');
  const snapDir = path.join(DATA, 'data', 'guncelleme-oncesi');
  check('güncelleme öncesi veri anlık görüntüsü alındı', fs.existsSync(snapDir) && fs.readdirSync(snapDir).some((f) => f.endsWith('.db')), fs.existsSync(snapDir) ? fs.readdirSync(snapDir).join(',') : 'yok');

  // ---------- 6) KURULUM ----------
  const go = await app.ev(`window.electronAPI.invoke('update-install', {openOrders:0,paymentInProgress:false})`);
  check('güvenli anda kurulum başlatıldı', go && go.ok === true, go?.message);
  app.close();
  let after = before;
  for (let i = 0; i < 90; i++) { await sleep(2000); try { after = fileVersion(); } catch {} if (after && after !== before) break; }
  check('6) kurulum tamamlandı: sürüm yükseldi', !!after && after !== before, `${before} → ${after}`);
  await sleep(6000);
  // kurulumdan sonra kendiliğinden yeniden açılan örnek (varsayılan veri klasörüyle) kapatılır
  try { execFileSync('powershell', ['-NoProfile', '-Command', `Get-Process | Where-Object { $_.Path -like '${APP_DIR.replace(/\//g, '\\')}*' } | Stop-Process -Force`]); } catch {}
  await sleep(3000);

  // ---------- 7) VERİ KORUNDU, YENİ SÜRÜM AÇILIYOR ----------
  app = await launch('feed-good/guncelleme');
  const info = await app.ev(`window.electronAPI.invoke('app-info')`);
  check('6) güncellenmiş uygulama AÇILDI', info && /^1\.1\.1/.test(info.version), info?.version);
  const kv = await app.ev(`window.electronAPI.invoke('kv-load-all').then(r => r.entries && r.entries['e2e_isletme_verisi'])`);
  check('7) işletme verisi güncellemeden sonra KORUNDU', kv === 'korunmali-12345', String(kv));
  await app.ev(`window.electronAPI.invoke('update-check')`);
  const same = await waitState(app, ['up-to-date', 'available', 'downloaded', 'error'], 60000);
  check('1) güncel sürümde "güncelleme yok" (normal çalışma)', same && same.state === 'up-to-date', same?.state);
  await kill(app);

  feed.close();
  const pass = results.filter(Boolean).length;
  console.log(`\nSONUÇ: ${pass}/${results.length} kontrol geçti (test verisi: ${DATA})`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
