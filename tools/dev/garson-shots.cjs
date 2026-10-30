// Geliştirme aracı: garson sayfasının farklı ekran boyutlarındaki görüntüsü + yatay taşma denetimi (gerçek başsız Edge).
// Veri: yalnızca bu betikte üretilen ÖRNEK masa/ürün (sunucuya yazılmaz). Kullanım: node tools/dev/garson-shots.cjs <çıktı-klasörü> [url]
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require(path.resolve(__dirname, '../../node_modules/ws'));

const OUT = path.resolve(process.argv[2] || 'tmp-shots');
const URL_ = process.argv[3] || 'http://127.0.0.1:8080/garson/';
fs.mkdirSync(OUT, { recursive: true });
const edge = process.env.BROWSER_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP = 9560;
const profile = 'C:/dev-test/shots-profile-' + Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((ok, no) => http.get(u, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => ok(JSON.parse(b))); }).on('error', no));

const VIEWPORTS = [
  { name: 'telefon-360', w: 360, h: 740, mobile: true },
  { name: 'telefon-yatay-740', w: 740, h: 360, mobile: true },
  { name: 'tablet-768', w: 768, h: 1024, mobile: true },
  { name: 'tablet-yatay-1024', w: 1024, h: 768, mobile: true },
  { name: 'masaustu-1440', w: 1440, h: 900, mobile: false },
];

(async () => {
  const proc = spawn(edge, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 30; i++) { try { tabs = await getJson(`http://127.0.0.1:${CDP}/json`); if (tabs.find((t) => t.type === 'page')) break; } catch {} await sleep(500); }
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } });
  const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.result?.value ?? r.result.exceptionDetails?.exception?.description; };
  await send('Page.enable'); await send('Runtime.enable');

  const problems = [];
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
  };
  // Yatay taşma: sayfa genişliğinden fazla genişleyen öğe var mı?
  const overflow = (label) => ev(`(function(){var w=document.documentElement.clientWidth;var bad=[];var inScroll=function(e){for(var a=e.parentElement;a&&a!==document.body;a=a.parentElement){var o=getComputedStyle(a).overflowX;if(o==='auto'||o==='scroll'||o==='hidden')return true}return false};document.querySelectorAll('body *').forEach(function(e){if(inScroll(e))return;var r=e.getBoundingClientRect();if(r.width>0&&r.height>0&&(r.right>w+1)){var cs=getComputedStyle(e);if(cs.position!=='fixed'||r.right>w+1)bad.push((e.id||e.className||e.tagName).toString().slice(0,40)+' sağ='+Math.round(r.right))}});return JSON.stringify({scrollW:document.documentElement.scrollWidth,w:w,bad:bad.slice(0,5)})})()`).then((j) => { const o = JSON.parse(j); if (o.scrollW > o.w + 1 || o.bad.length) problems.push(`${label}: taşma scrollW=${o.scrollW} w=${o.w} ${o.bad.join(' | ')}`); return o; });

  for (const vp of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile });
    await send('Page.navigate', { url: URL_ });
    await sleep(2500);
    // 1) eşleştirme ekranı
    await ev(`localStorage.clear(); 1`);
    await send('Page.navigate', { url: URL_ });
    await sleep(2000);
    await shot(`${vp.name}-1-acilis`); await overflow(`${vp.name} açılış`);

    // 2) PIN ekranı
    await ev(`(function(){ if (typeof showPinScreen==='function') showPinScreen(); return 1 })()`);
    await sleep(500);
    await shot(`${vp.name}-2-pin`); await overflow(`${vp.name} pin`);

    // 3) ana ekran: örnek veri (yalnızca ekran, sunucu çağrısı yok)
    await ev(`(function(){
      var secs=[{id:'s1',name:'Ana Salon'},{id:'s2',name:'Bahçe'},{id:'s3',name:'Üst Kat'}];
      var tabs=[];for(var i=1;i<=36;i++){var occ=i%4===0;tabs.push({id:'t'+i,sectionId:i<=20?'s1':(i<=30?'s2':'s3'),name:'Masa '+i,status:occ?'OCCUPIED':'EMPTY',order:occ?{totalAmount:100*i,items:[{productName:'Adana',quantity:2,price:50}],orderTime:'19:'+(10+i)}:null});}
      var cats=[{id:'c1',name:'Kebaplar'},{id:'c2',name:'İçecekler'}];
      var prods=[];for(var j=1;j<=24;j++){prods.push({id:'p'+j,name:'Örnek Ürün '+j+' uzun isim',price:40+j,categoryId:j%2?'c1':'c2',active:true});}
      window.liveSections=secs;window.liveTables=tabs;window.liveProducts=prods;window.liveCategories=cats;
      try{liveSections=secs;liveTables=tabs;liveProducts=prods;liveCategories=cats;}catch(e){}
      currentWaiter={id:'w1',name:'Test Garson'};updateWaiterUI();
      document.getElementById('pinScreen').classList.add('hidden');document.getElementById('pairingScreen').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('hidden');document.getElementById('mainApp').classList.add('flex');
      renderSectionTabs();renderTables();updateHeaderStats();return 1})()`);
    await sleep(600);
    await shot(`${vp.name}-3-masalar`); await overflow(`${vp.name} masalar`);

    // 4) sipariş penceresi
    await ev(`(function(){ var t=liveTables.find(function(x){return x.id==='t4'}); selectedTable=t; openOrderModal(t); return 1 })()`);
    await sleep(800);
    await shot(`${vp.name}-4-siparis`); await overflow(`${vp.name} sipariş`);
  }
  ws.close(); proc.kill();
  console.log(problems.length ? 'TAŞMA/SORUN:\n' + problems.join('\n') : 'Yatay taşma yok (tüm ekranlar).');
  console.log('Görüntüler: ' + OUT);
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
