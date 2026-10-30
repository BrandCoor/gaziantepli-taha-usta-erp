// Geliştirme aracı: garson PWA'yı gerçek (başsız) Edge/Chrome ile doğrular. Kullanım: node tools/dev/pwa-check.cjs http://127.0.0.1:8080/garson/
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const WebSocket = require(path.resolve(__dirname, '../../node_modules/ws'));

const url = process.argv[2] || 'http://127.0.0.1:8080/garson/';
const edge = process.env.BROWSER_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9444;
const profile = 'C:/dev-test/pwa-profile-' + Date.now();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((ok, no) => http.get(u, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => ok(JSON.parse(b))); }).on('error', no));

(async () => {
  const proc = spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 30; i++) { try { tabs = await getJson(`http://127.0.0.1:${port}/json`); if (tabs.find((t) => t.type === 'page')) break; } catch {} await sleep(500); }
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } });
  const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.result.value ?? r.result.exceptionDetails?.exception?.description; };
  const results = [];
  const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'GEÇTİ  ' : 'KALDI  ') + name + (extra ? '  → ' + extra : '')); };

  await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable');
  const consoleErrors = [];
  ws.on('message', (m) => { const r = JSON.parse(m); if (r.method === 'Runtime.exceptionThrown') consoleErrors.push(r.params.exceptionDetails.text + ' ' + (r.params.exceptionDetails.exception?.description || '')); });
  const failedReq = [];
  ws.on('message', (m) => { const r = JSON.parse(m); if (r.method === 'Network.loadingFailed') failedReq.push(r.params.errorText + ' ' + (r.params.canceled ? '(iptal)' : '')); });

  await send('Page.navigate', { url });
  await sleep(4000);

  check('sayfa başlığı', (await ev('document.title')).includes('Garson'), await ev('document.title'));
  check('arka plan stili yerel CSS ile uygulandı (koyu tema)', (await ev('getComputedStyle(document.body).backgroundColor')) === 'rgb(20, 20, 22)', await ev('getComputedStyle(document.body).backgroundColor'));
  check('Font Awesome yerelden yüklendi', await ev(`document.fonts.load('900 1em "Font Awesome 6 Free"').then(f=>f.length>0)`));
  const manifest = await send('Page.getAppManifest');
  check('manifest okundu, hata yok', !manifest.result.errors?.length && /manifest/.test(manifest.result.url || ''), (manifest.result.errors || []).map((e) => e.message).join(';'));
  const mdata = JSON.parse(manifest.result.data || '{}');
  check('manifest: standalone + 192/512 simge', mdata.display === 'standalone' && (mdata.icons || []).some((i) => i.sizes === '192x192') && (mdata.icons || []).some((i) => i.sizes === '512x512'));

  const swReady = await ev(`Promise.race([navigator.serviceWorker.ready.then(r=>r.active && r.active.state), new Promise(r=>setTimeout(()=>r('zaman aşımı'),6000))])`);
  check('servis çalışanı kayıtlı ve aktif', swReady === 'activated', String(swReady));
  const cached = await ev(`caches.keys().then(async ks=>{let n=0;for(const k of ks){n+=(await (await caches.open(k)).keys()).length}return ks.join(',')+' / '+n+' dosya'})`);
  check('uygulama kabuğu önbellekte', /garson-v\d+ \/ \d+ dosya/.test(cached) && parseInt(cached.split('/ ')[1]) >= 8, cached);
  const apiCached = await ev(`caches.keys().then(async ks=>{for(const k of ks){for(const r of await (await caches.open(k)).keys()){if(r.url.includes('/api/'))return true}}return false})`);
  check('API istekleri ASLA önbelleğe alınmaz', apiCached === false);

  // ---- ÇEVRİMDIŞI ----
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await send('Page.reload');
  await sleep(3500);
  check('çevrimdışı: sayfa önbellekten açılıyor', (await ev('document.title')).includes('Garson'), await ev('document.title'));
  check('çevrimdışı: stil önbellekten geliyor', (await ev('getComputedStyle(document.body).backgroundColor')) === 'rgb(20, 20, 22)');
  await sleep(500);
  const banner = await ev(`(function(){var b=document.getElementById('connBanner');return b? (b.classList.contains('hidden')?'GİZLİ':b.textContent):'YOK'})()`);
  check('çevrimdışı: "sipariş gönderilemez" uyarısı görünür', /gönderilemez|yüklenemedi/.test(banner), banner);

  // çevrimdışıyken sipariş gönderme dürüst hata vermeli (sahte başarı yok)
  const offlineSend = await ev(`(async()=>{try{const r=await fetch('../api/index.php?action=send_order',{method:'POST',body:'{}'});return 'ağ yanıtı '+r.status}catch(e){return 'HATA: '+e.message}})()`);
  check('çevrimdışı: sipariş isteği başarısız olur (taklit edilmez)', /HATA/.test(offlineSend), offlineSend);

  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  console.log('\nTarayıcı hataları:', consoleErrors.length ? consoleErrors.join(' | ') : 'yok');
  const bad = failedReq.filter((x) => !/ERR_INTERNET_DISCONNECTED/.test(x));
  console.log('Başarısız ağ istekleri (çevrimdışı hariç):', bad.length ? bad.join(' | ') : 'yok');
  ws.close(); proc.kill();
  const pass = results.filter(Boolean).length;
  console.log(`\nSONUÇ: ${pass}/${results.length} kontrol geçti`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
