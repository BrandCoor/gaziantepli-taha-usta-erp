// Kasa arayüzü: ürün seçenekleri (boyut/porsiyon) — gerçek derleme (dist) + gerçek başsız Edge.
// Veri yalnızca bu tarayıcı profilinin localStorage'ına (izole) yazılır. Kullanım: npx vite build && node tools/dev/ui-variants.cjs <png klasörü>
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require(path.resolve(__dirname, '../../node_modules/ws'));

const DIST = path.resolve(__dirname, '../../dist');
const OUT = path.resolve(process.argv[2] || 'tmp-ui');
fs.mkdirSync(OUT, { recursive: true });
const edge = process.env.BROWSER_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 8094, CDP = 9575;
const profile = 'C:/dev-test/ui-profile-' + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((ok, no) => http.get(u, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => ok(JSON.parse(b))); }).on('error', no));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'GEÇTİ  ' : 'KALDI  ') + name + (extra ? '  → ' + extra : '')); };

const SEED = {
  gtu_pos_sections: [{ id: 's1', name: 'Salon', tableCount: 4, capacityPerTable: 4 }],
  gtu_pos_categories: [{ id: 'c1', name: 'Yemekler', color: '#f59e0b' }],
  gtu_pos_products: [
    { id: 'pa', categoryId: 'c1', name: 'Ayran', price: 25, isAvailable: true, variants: [{ id: 'va', name: '330 ml', price: 25 }, { id: 'vb', name: '1 Litre', price: 60.5 }] },
    { id: 'pk', categoryId: 'c1', name: 'Adana Kebap', price: 280, isAvailable: true, variants: [{ id: 'k1', name: '1 Porsiyon', price: 280 }, { id: 'k2', name: '1,5 Porsiyon', price: 400 }] },
    { id: 'pt', categoryId: 'c1', name: 'Çorba', price: 70, isAvailable: true },
  ],
};

(async () => {
  const srv = http.createServer((req, res) => {
    let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
    if (f.endsWith(path.sep) || !fs.existsSync(f)) f = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  }).listen(PORT, '127.0.0.1');
  const proc = spawn(edge, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--window-size=1500,950', 'about:blank'], { stdio: 'ignore' });
  const done = (code) => { try { proc.kill(); srv.close(); } catch {} process.exit(code); };
  try {
    let tabs;
    for (let i = 0; i < 30; i++) { try { tabs = await getJson(`http://127.0.0.1:${CDP}/json`); if (tabs.find((t) => t.type === 'page')) break; } catch {} await sleep(500); }
    const page = tabs.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.on('open', r));
    let id = 0; const pending = new Map();
    ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } });
    const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.result?.value ?? r.result.exceptionDetails?.exception?.description; };
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); };
    // metne göre tıkla (en içteki eşleşen button/div)
    const clickText = (text, sel = 'button') => ev(`(function(){var els=Array.from(document.querySelectorAll(${JSON.stringify(sel)})).filter(function(e){return e.innerText && e.innerText.indexOf(${JSON.stringify(text)})>-1});if(!els.length)return false;els.sort(function(a,b){return a.innerText.length-b.innerText.length});els[0].click();return true})()`);
    const setInput = (placeholder, value) => ev(`(function(){var i=Array.from(document.querySelectorAll('input')).find(function(e){return e.placeholder&&e.placeholder.indexOf(${JSON.stringify(placeholder)})>-1});if(!i)return false;var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
    const bodyText = () => ev('document.body.innerText');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.entries(${JSON.stringify(SEED)}).forEach(function(kv){ if(!localStorage.getItem(kv[0])) localStorage.setItem(kv[0], JSON.stringify(kv[1])); });` });

    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    await sleep(3000);
    // ilk kurulum: yönetici hesabı
    await setInput('Ad Soyad', 'Test Yönetici'); await setInput('Kullanıcı adı', 'testadmin'); await setInput('Parola (en az', 'Gizli-Parola-123'); await setInput('Parola (tekrar)', 'Gizli-Parola-123');
    await clickText('Hesabı', 'button') || await ev(`document.querySelector('form button[type=submit], form button').click()`);
    await sleep(3500);
    check('kasa açıldı (POS ekranı)', /Masa|Salon/.test(await bodyText()), (await bodyText()).slice(0, 60).replace(/\n/g, ' '));

    // masa seç
    await ev(`(function(){var c=Array.from(document.querySelectorAll('button,div')).filter(function(e){return /Salon 1|Masa 1\\b/.test(e.innerText||'') && e.innerText.length<60});c.sort(function(a,b){return a.innerText.length-b.innerText.length});if(c[0])c[0].click()})()`);
    await sleep(1500);
    await shot('1-pos-urunler');
    let txt = await bodyText();
    check('menüde seçenekli ürün fiyat aralığıyla görünür', /Ayran/.test(txt) && /25 – 60[.,]?5?0?\s?₺|25 – 60/.test(txt), (txt.match(/Ayran[^\n]*\n?[^\n]*/) || [''])[0]);

    // Ayran → seçenek penceresi
    await clickText('Ayran', 'button');
    await sleep(600);
    txt = await bodyText();
    check('seçenekli ürüne dokununca SEÇENEK penceresi açılır (kendiliğinden eklenmez)', /Boyut \/ porsiyon seçin/.test(txt) && /330 ml/.test(txt) && /1 Litre/.test(txt));
    await shot('2-secenek-penceresi');
    await clickText('1 Litre', 'button');
    await sleep(600);
    txt = await bodyText();
    check('seçilen seçenek adisyona "Ayran (1 Litre)" 60,50 ₺ olarak eklendi', /Ayran \(1 Litre\)/.test(txt) && /60[.,]50/.test(txt));

    // aynı ürün başka seçenek → ayrı kalem; aynı seçenek → adet artar
    await clickText('Ayran', 'button'); await sleep(400); await clickText('330 ml', 'button'); await sleep(500);
    await clickText('Ayran', 'button'); await sleep(400); await clickText('330 ml', 'button'); await sleep(500);
    txt = await bodyText();
    check('farklı seçenek AYRI kalem olur (330 ml ve 1 Litre birlikte)', /Ayran \(330 ml\)/.test(txt) && /Ayran \(1 Litre\)/.test(txt));
    await shot('3-adisyon');
    const items = await ev(`Array.from(document.querySelectorAll('*')).filter(function(e){return e.children.length===0 && /^Ayran \\(330 ml\\)$/.test((e.textContent||'').trim())}).length`);
    check('aynı seçenek iki kez eklenince tek satır (adet artar)', items === 1, 'satır=' + items);

    // seçeneksiz ürün doğrudan eklenir
    await clickText('Çorba', 'button'); await sleep(500);
    check('seçeneksiz ürün doğrudan eklenir', (await bodyText()).includes('Çorba') && !/Boyut \/ porsiyon seçin/.test(await bodyText()));

    // ---- Ayarlar › Menü & Ürünler: seçenek düzenleme ----
    await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).filter(function(e){return e.className.indexOf('rounded-full')>-1 && e.innerText.trim()==='✕'||e.querySelector('svg.lucide-circle-x,svg.lucide-x')});if(b.length)b[b.length-1].click()})()`);
    await sleep(500);
    await clickText('Restoran & Donanım Ayarları', 'button'); await sleep(800);
    await clickText('Menü & Ürünler', 'button'); await sleep(800);
    txt = await bodyText();
    check('ürün listesinde seçenekli ürün "N seçenek: adlar" olarak görünür', txt.includes('2 seçenek: 330 ml · 1 Litre'), String(txt.split(String.fromCharCode(10)).find((l) => l.includes('seçenek:')) || 'yok'));
    await ev(`(function(){var r=Array.from(document.querySelectorAll('tr')).filter(function(e){return e.innerText.indexOf('Adana Kebap')>-1})[0]; var btns=r?Array.from(r.querySelectorAll('button')):[]; var edit=btns.filter(function(b){return b.innerText.indexOf('seçenek')===-1}); (btns.find(function(b){return b.innerText.indexOf('seçenek')>-1})||btns[0]).click()})()`);
    await sleep(700);
    const rows = await ev(`Array.from(document.querySelectorAll('input[placeholder^="Seçenek adı"]')).map(function(i){return i.value}).join('|')`);
    check('ürün düzenlemede seçenekler satır satır dolu gelir', rows === '1 Porsiyon|1,5 Porsiyon', String(rows));
    await shot('4-urun-duzenle');
    // yeni seçenek ekle + kaydet
    await clickText('+ Seçenek ekle', 'button'); await sleep(300);
    await ev(`(function(){var ins=Array.from(document.querySelectorAll('input[placeholder^="Seçenek adı"]'));var last=ins[ins.length-1];var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(last,'2 Porsiyon');last.dispatchEvent(new Event('input',{bubbles:true}));var pr=last.parentElement.querySelector('input[type=number]');d.set.call(pr,'520');pr.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await clickText('Kaydet', 'button') || await ev(`document.querySelector('form button[type=submit]').click()`);
    await sleep(800);
    const saved = JSON.parse(await ev(`localStorage.getItem('gtu_pos_products')`)).find((p) => p.id === 'pk');
    check('kayıt: 3 seçenek, ürün fiyatı en düşük seçenek', saved.variants.length === 3 && saved.variants[2].name === '2 Porsiyon' && saved.variants[2].price === 520 && saved.price === 280, JSON.stringify(saved.variants.map((v) => [v.name, v.price])));
    // geçersiz: fiyatsız seçenek kaydedilmez
    await ev(`(function(){var r=Array.from(document.querySelectorAll('tr')).filter(function(e){return e.innerText.indexOf('Adana Kebap')>-1})[0]; Array.from(r.querySelectorAll('button')).find(function(b){return b.innerText.indexOf('seçenek')>-1}).click()})()`);
    await sleep(500);
    await clickText('+ Seçenek ekle', 'button'); await sleep(200);
    await ev(`(function(){var ins=Array.from(document.querySelectorAll('input[placeholder^="Seçenek adı"]'));var last=ins[ins.length-1];var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(last,'Fiyatsız');last.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await clickText('Kaydet', 'button') || await ev(`document.querySelector('form button[type=submit]').click()`);
    await sleep(600);
    const still = JSON.parse(await ev(`localStorage.getItem('gtu_pos_products')`)).find((p) => p.id === 'pk');
    check('fiyatı olmayan seçenek KAYDEDİLMEZ (uyarı verilir)', still.variants.length === 3);

    ws.close();
    const pass = results.filter(Boolean).length;
    console.log(`\nSONUÇ: ${pass}/${results.length} kontrol geçti (görüntüler: ${OUT})`);
    done(pass === results.length ? 0 : 1);
  } catch (e) { console.error(e); done(2); }
})();
