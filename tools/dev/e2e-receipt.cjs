// Gerçek Electron (geliştirme derlemesi: dist-electron) ile fiş baskı hattı: önizleme PNG'leri + sahte ağ yazıcısına gerçek baskı baytları.
// Kullanım: npx vite build && node tools/dev/e2e-receipt.cjs <png-çıktı-klasörü>
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require(path.resolve(__dirname, '../../node_modules/ws'));

const ROOT = path.resolve(__dirname, '../..');
const ELECTRON = path.join(ROOT, 'node_modules/electron/dist/electron.exe');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'tmp-receipts'));
fs.mkdirSync(OUT, { recursive: true });
const DATA = 'C:/dev-test/receipt-userdata-' + Date.now();
const CDP = 9572, PRINTER_PORT = 9101;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((ok, no) => http.get(u, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => ok(JSON.parse(b))); }).on('error', no));
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'GEÇTİ  ' : 'KALDI  ') + name + (extra ? '  → ' + extra : '')); };

const samples = {
  KITCHEN: { ticketTitle: 'OCAK / IZGARA SİPARİŞİ', tableName: 'Ana Salon / Masa 4', waiterName: 'Şükrü', orderTime: '19:42', orderNumber: 17, items: [{ name: 'Adana Kebap', quantity: 2, note: 'Acılı, köz biberli, soğansız' }, { name: 'Lahmacun (0.5 Porsiyon)', quantity: 3 }, { name: 'Şalgam Suyu', quantity: 1, isGift: true }], orderNote: 'Çocuk için sade, çabuk gelsin', isAdditionalOrder: true },
  BILL: { settings: { title: 'GAZİANTEPLİ TAHA USTA', subtitle: 'Kebap & Lahmacun Salonu', address: 'Şehitkamil / Gaziantep', phone: '0 342 000 00 00', footerMessage: 'Afiyet olsun, yine bekleriz!' }, tableName: 'Ana Salon / Masa 4', waiterName: 'Şükrü', orderTime: '30.10.2026 19:42', orderNumber: 17, items: [{ name: 'Adana Kebap', quantity: 2, price: 280, totalPrice: 560, note: 'Acılı' }, { name: 'Yayık Ayranı', quantity: 3, price: 40, totalPrice: 120 }, { name: 'Antep Fıstıklı Katmer', quantity: 1, price: 160, totalPrice: 160 }], subtotal: 840, discountAmount: 40, discountReason: 'İndirim', totalAmount: 800 },
  CANCEL: { tableName: 'Masa 2', waiterName: 'Ali', orderTime: '20:05', items: [{ name: 'Çiğ Köfte', quantity: 1, reason: 'Yanlış sipariş' }], reason: 'Müşteri vazgeçti' },
  BILL_KURYE: { isCourierTicket: true, platformName: 'GETİR YEMEK', orderNumber: 'A1', orderTime: '20:10', courierName: 'Veli', paymentMethod: 'Kapıda Nakit', totalAmount: 450, showPrices: false, customerInfo: { name: 'Ayşe Yılmaz', phone: '0555 000 00 00', address: 'Gül Sokak No:4 Daire:2 Şahinbey/Gaziantep', note: 'Zil bozuk, arayınız' }, items: [{ name: 'Adana Kebap', quantity: 1, price: 450 }] },
  Z_REPORT: { zNo: 3, closedAt: '30.10.2026 23:59', closedBy: 'Taha Usta', totalOrders: 42, paymentBreakdown: { Nakit: 5200.5, 'Kredi Kartı': 3100 }, netTotal: 8300.5, discountTotal: 120, totalExpenses: 900, netCashInRegister: 4300.5, productSales: { 'Adana Kebap': { quantity: 30, total: 8400 }, Ayran: { quantity: 55, total: 2200 } } },
  HARDWARE_TEST: { printerName: 'Kasa Yazıcısı', paperWidth: 80 },
};

(async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const proc = spawn(ELECTRON, ['.', `--user-data-dir=${DATA}`, `--remote-debugging-port=${CDP}`], { cwd: ROOT, env, stdio: 'ignore' });
  let page;
  for (let i = 0; i < 60; i++) { try { const tabs = await getJson(`http://127.0.0.1:${CDP}/json`); page = tabs.find((t) => t.type === 'page' && !t.url.startsWith('devtools')); if (page) break; } catch {} await sleep(500); }
  if (!page) { proc.kill(); throw new Error('Electron penceresi açılmadı (önce npx vite build)'); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } });
  const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.result?.value ?? r.result.exceptionDetails?.exception?.description; };
  await send('Runtime.enable');
  await sleep(2500);

  for (const [name, data] of Object.entries(samples)) {
    const type = name === 'BILL_KURYE' ? 'BILL' : name;
    for (const pw of [80, 58]) {
      const r = await ev(`window.electronAPI.invoke('receipt-preview', ${JSON.stringify({ jobType: type, data: { ...data, paperWidth: pw } })})`);
      const ok = !!(r && r.success && /^data:image\/png;base64,/.test(r.image));
      check(`önizleme ${name} ${pw}mm`, ok, ok ? '' : JSON.stringify(r));
      if (ok) fs.writeFileSync(path.join(OUT, `${name}-${pw}.png`), Buffer.from(r.image.split(',')[1], 'base64'));
    }
  }

  // Sahte ağ yazıcısı: gerçek baskı baytlarını yakala
  const got = [];
  const srv = net.createServer((sock) => { const chunks = []; sock.on('data', (d) => chunks.push(d)); sock.on('end', () => got.push(Buffer.concat(chunks))); }).listen(PRINTER_PORT, '127.0.0.1');
  for (const mode of ['GRAPHIC', 'TEXT']) {
    got.length = 0;
    const r = await ev(`window.electronAPI.invoke('print-network-ticket', ${JSON.stringify({ ip: '127.0.0.1', port: PRINTER_PORT, ticketType: 'KITCHEN', data: { ...samples.KITCHEN, paperWidth: 80, autoCut: true, printMode: mode } })})`);
    await sleep(800);
    const buf = got[0] || Buffer.alloc(0);
    check(`ağ yazıcısına ${mode} baskı iletildi`, r && r.success === true && buf.length > 50, `${buf.length} bayt`);
    if (mode === 'GRAPHIC') {
      check('grafik baskı: raster komutu (GS v 0) ve kesim var', buf.includes(Buffer.from([0x1d, 0x76, 0x30, 0x00])) && buf.includes(Buffer.from([0x1d, 0x56, 0x42, 0x00])) && buf.length > 20000, `${buf.length} bayt`);
    } else {
      check('metin baskı: raster YOK, düz metin var', !buf.includes(Buffer.from([0x1d, 0x76, 0x30])) && buf.toString('latin1').includes('Adana Kebap'));
    }
  }
  srv.close();
  ws.close(); proc.kill();
  const pass = results.filter(Boolean).length;
  console.log(`\nSONUÇ: ${pass}/${results.length} kontrol geçti  (PNG'ler: ${OUT})`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
