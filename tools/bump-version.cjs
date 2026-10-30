/**
 * Tek komutla sürüm yükseltir (kasa + garson PWA + sunucu). Kullanım: node tools/bump-version.cjs 1.2.0 [--api 1.2.0]
 *  - package.json (kasa)            - garson/sw.js, garson/index.html, garson/version.json (PWA)
 *  - api/version.php GTU_API_VERSION (yalnızca --api verilirse: sunucu kodu değişmediyse dokunulmaz)
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || '')) { console.error('Kullanım: node tools/bump-version.cjs 1.2.0 [--api 1.2.0]'); process.exit(1); }
const apiIdx = process.argv.indexOf('--api');
const apiV = apiIdx > 0 ? process.argv[apiIdx + 1] : null;

function edit(rel, fn) {
  const p = path.join(root, rel);
  const s = fs.readFileSync(p, 'utf8');
  const crlf = s.includes('\r\n');
  const out = fn(s.replace(/\r\n/g, '\n'));
  if (out === null) { console.error('Desen bulunamadı: ' + rel); process.exit(1); }
  fs.writeFileSync(p, crlf ? out.replace(/\n/g, '\r\n') : out);
  console.log('güncellendi: ' + rel);
}
const sub = (s, re, rep) => (re.test(s) ? s.replace(re, rep) : null);

edit('package.json', (s) => sub(s, /("version":\s*")\d+\.\d+\.\d+(")/, `$1${v}$2`));
edit('cpanel-yuklenecekler/garson/sw.js', (s) => sub(s, /const VERSION = 'garson-v[\d.]+';/, `const VERSION = 'garson-v${v}';`));
edit('cpanel-yuklenecekler/garson/index.html', (s) => sub(s, /const GARSON_VERSION = '[\d.]+';/, `const GARSON_VERSION = '${v}';`));
fs.writeFileSync(path.join(root, 'cpanel-yuklenecekler/garson/version.json'), JSON.stringify({ version: v }) + '\n');
console.log('güncellendi: cpanel-yuklenecekler/garson/version.json');
if (apiV) {
  if (!/^\d+\.\d+\.\d+$/.test(apiV)) { console.error('Geçersiz --api sürümü'); process.exit(1); }
  edit('cpanel-yuklenecekler/api/version.php', (s) => sub(s, /const GTU_API_VERSION = '[\d.]+';/, `const GTU_API_VERSION = '${apiV}';`));
}
