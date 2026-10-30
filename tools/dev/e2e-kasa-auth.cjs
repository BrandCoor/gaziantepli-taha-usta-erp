// UÇTAN UCA: gerçek Electron kasa penceresi, izole profil. İlk kurulum, hash'li parola, giriş kilidi.
const { spawn, execSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const WebSocket = require(path.resolve(__dirname, '../../node_modules/ws'));

const root = path.resolve(__dirname, '../..');
const electron = path.join(root, 'node_modules/electron/dist/electron.exe');
const port = 9666;
const profile = 'C:/dev-test/e2e-kasa-' + Date.now();
const backups = profile + '-yedek';
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
  proc = spawn(electron, ['.', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`], { cwd: root, env, stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 40; i++) { try { tabs = await getJson(`http://127.0.0.1:${port}/json`); if (tabs.find((t) => t.type === 'page' && t.url.startsWith('file:'))) break; } catch {} await sleep(500); }
  const page = tabs.find((t) => t.type === 'page' && t.url.startsWith('file:'));
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  ws.on('message', (m) => { const r = JSON.parse(m); if (pending.has(r.id)) { pending.get(r.id)(r); pending.delete(r.id); } });
  await send('Runtime.enable');
  await sleep(2500);
}
async function quit() { try { ws.close(); } catch {} try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch {} await sleep(1500); }

// React kontrollü input'a değer yazar
const setInput = (placeholderOrType, value) => ev(`(function(){
  var els=[].slice.call(document.querySelectorAll('input'));
  var el=els.find(function(e){return e.placeholder && e.placeholder.indexOf(${JSON.stringify(placeholderOrType)})===0}) || els.find(function(e){return e.type===${JSON.stringify(placeholderOrType)}});
  if(!el) return 'YOK';
  var set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(el,${JSON.stringify(value)});
  el.dispatchEvent(new Event('input',{bubbles:true})); return 'ok';})()`);
const clickText = (txt) => ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return x.innerText.indexOf(${JSON.stringify(txt)})>-1}); if(!b) return 'YOK'; b.click(); return 'ok'})()`);
const bodyText = () => ev(`document.body.innerText`);

(async () => {
  await launch();

  let t = await bodyText();
  check('temiz kurulumda İLK KURULUM ekranı açılıyor', /İlk Kurulum/.test(t));
  check('varsayılan hesap yok (kayıtlı kullanıcı yok)', (await ev(`localStorage.getItem('gtu_erp_users')`)) === null);
  check('hazır "admin" girişi önerilmiyor', !/admin/i.test(t.replace(/yönetici/gi, '')));

  await setInput('Ad Soyad', 'Test Patron'); await setInput('Kullanıcı adı', 'patron');
  await setInput('Parola (en az', '123456'); await setInput('Parola (tekrar', '123456');
  await clickText('Yönetici Hesabını Oluştur'); await sleep(600);
  t = await bodyText();
  check('zayıf parola (123456) reddedildi', /kolay tahmin/.test(t), (t.match(/[^\n]*kolay tahmin[^\n]*/) || [''])[0]);

  await setInput('Parola (en az', 'Antep2026!'); await setInput('Parola (tekrar', 'Farkli2026!');
  await clickText('Yönetici Hesabını Oluştur'); await sleep(600);
  check('parolalar eşleşmezse reddedildi', /eşleşmiyor/.test(await bodyText()));

  await setInput('Parola (tekrar', 'Antep2026!');
  await clickText('Yönetici Hesabını Oluştur'); await sleep(2500);
  t = await bodyText();
  check('doğru bilgilerle yönetici oluştu ve uygulama açıldı', /Restoran Masaları|Özet & Kasa Durumu/.test(t));
  const stored = await ev(`localStorage.getItem('gtu_erp_users')`);
  const users = JSON.parse(stored || '[]');
  check('parola PBKDF2 hash olarak saklandı, düz metin yok', users.length === 1 && users[0].password.startsWith('pbkdf2$') && !stored.includes('Antep2026!'));
  check('kullanıcı yönetici rolünde', users[0] && users[0].role === 'ADMIN');

  // ---- yeniden başlatma: oturum kapanır, giriş istenir
  await quit();
  await launch();
  t = await bodyText();
  check('yeniden başlatınca giriş ekranı (ilk kurulum değil)', !/İlk Kurulum/.test(t) && /Giriş|Şifre|şifre/.test(t));

  const loginWith = async (pw) => { await setInput('password', pw); await ev(`document.querySelector('form').requestSubmit()`); await sleep(1200); };
  for (let i = 0; i < 5; i++) await loginWith('yanlis-parola-' + i);
  t = await bodyText();
  check('5 hatalı denemeden sonra giriş kilitlendi', /Çok fazla hatalı deneme/.test(t), (t.match(/[^\n]*Çok fazla[^\n]*/) || [''])[0]);
  await loginWith('Antep2026!');
  t = await bodyText();
  check('kilitliyken DOĞRU parola bile kabul edilmiyor', /Çok fazla hatalı deneme/.test(t) && !/Restoran Masaları/.test(t));

  await ev(`localStorage.removeItem('gtu_login_throttle')`); // kilit süresinin dolmasını simüle eder
  await loginWith('Antep2026!');
  t = await bodyText();
  check('kilit kalkınca doğru parolayla giriş yapıldı', /Restoran Masaları|Özet & Kasa Durumu/.test(t));

  // ---- eski düz metin kayıttan hash'e otomatik yükseltme
  await ev(`(function(){var u=JSON.parse(localStorage.getItem('gtu_erp_users')); u[0].password='eskiParola9'; localStorage.setItem('gtu_erp_users', JSON.stringify(u)); location.reload()})()`);
  await sleep(2500);
  await loginWith('eskiParola9');
  const up = JSON.parse(await ev(`localStorage.getItem('gtu_erp_users')`));
  check('eski düz metin parola girişte hash\'e yükseltildi', /Restoran Masaları|Özet & Kasa Durumu/.test(await bodyText()) && up[0].password.startsWith('pbkdf2$'));

  await quit();
  fs.rmSync(profile, { recursive: true, force: true });
  fs.rmSync(backups, { recursive: true, force: true });
  const pass = results.filter(Boolean).length;
  console.log(`\nSONUÇ: ${pass}/${results.length} kontrol geçti`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(async (e) => { console.error(e); try { await quit(); } catch {} process.exit(2); });
