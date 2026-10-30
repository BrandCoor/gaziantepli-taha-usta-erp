// QR menü sayfası: seçenekli ürün (gerçek başsız Edge). Sunucuya yazmaz; ürün verisi sayfada üretilir.
// Kullanım: node tools/dev/qr-variants-check.cjs [url]   (varsayılan http://127.0.0.1:8080/menu/)
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const WebSocket = require(path.resolve(__dirname, '../../node_modules/ws'));
const url = process.argv[2] || 'http://127.0.0.1:8080/menu/';
const edge = process.env.BROWSER_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP = 9577;
const profile = 'C:/dev-test/qr-profile-' + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((ok, no) => http.get(u, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => ok(JSON.parse(b))); }).on('error', no));
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'GEÇTİ  ' : 'KALDI  ') + name + (extra ? '  → ' + extra : '')); };

(async () => {
  const proc = spawn(edge, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  try {
    let tabs;
    for (let i = 0; i < 30; i++) { try { tabs = await getJson(`http://127.0.0.1:${CDP}/json`); if (tabs.find((t) => t.type === 'page')) break; } catch {} await sleep(500); }
    const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.on('open', r));
    let id = 0; const pending = new Map(); const errors = [];
    ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } if (r.method === 'Runtime.exceptionThrown') errors.push(r.params.exceptionDetails.exception?.description || r.params.exceptionDetails.text); });
    const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.result?.value ?? r.result.exceptionDetails?.exception?.description; };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate', { url });
    await sleep(3500);
    check('sayfa hatasız yüklendi', errors.length === 0, errors.join(' | '));
    check('uydurma yedek menü/görsel YOK', (await ev(`FALLBACK_PRODUCTS.length === 0 && FALLBACK_CATEGORIES.length === 0 && document.documentElement.innerHTML.indexOf('unsplash') === -1`)) === true);

    await ev(`(function(){ liveCategories=[{id:'c1',name:'İçecekler'}]; liveProducts=[{id:'pa',categoryId:'c1',name:'Ayran',price:25,variants:[{id:'va',name:'330 ml',price:25},{id:'vb',name:'1 Litre',price:60.5}]},{id:'pt',categoryId:'c1',name:'Çorba',price:70}]; renderCategoryTabs(); renderProducts(); return 1 })()`);
    await sleep(400);
    check('listede seçenekli ürün "25 ₺\'den" gösterilir', (await ev(`document.getElementById('productsGrid') ? document.getElementById('productsGrid').innerText : document.body.innerText`)).includes("25 ₺'den"));
    await ev(`openProductModal(liveProducts[0]); 1`);
    await sleep(300);
    check('detayda seçenekler listelenir, ilk seçenek seçili gelir', (await ev(`document.getElementById('modalVariantBox').children.length`)) === 2 && (await ev(`document.getElementById('modalProductPrice').innerText`)) === '25 ₺');
    await ev(`document.getElementById('modalVariantBox').children[1].click(); 1`);
    check('seçenek değişince fiyat ve toplam güncellenir', (await ev(`document.getElementById('modalProductPrice').innerText`)) === '60.50 ₺' && /60\.50/.test(await ev(`document.getElementById('modalAddBtnText').innerText`)));
    await ev(`changeModalQuantity(1); confirmAddToCart(); 1`);
    check('sepette seçenek adı, fiyatı ve kimliği', (await ev(`JSON.stringify(cart.map(function(c){return [c.productName,c.price,c.variantId,c.quantity]}))`)) === '[["Ayran (1 Litre)",60.5,"vb",2]]');
    await ev(`openProductModal(liveProducts[1]); 1`);
    check('seçeneksiz üründe seçenek kutusu gizli', (await ev(`document.getElementById('modalVariantBox').classList.contains('hidden')`)) === true);
    ws.close(); proc.kill();
    const pass = results.filter(Boolean).length;
    console.log(`\nSONUÇ: ${pass}/${results.length} kontrol geçti`);
    process.exit(pass === results.length ? 0 : 1);
  } catch (e) { console.error(e); try { proc.kill(); } catch {} process.exit(2); }
})();
