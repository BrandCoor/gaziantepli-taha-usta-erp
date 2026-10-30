/**
 * Alt alan adlı dağıtım için 4 ayrı yükleme paketi üretir (her biri bir cPanel "belge kökü"nün İÇİNE çıkarılır):
 *   api.zip → api.ornek.com     garson.zip → garson.ornek.com     menu.zip → qr.ornek.com     patron.zip → patron.ornek.com
 *
 * Kullanım:
 *   node tools/make-deploy-package.cjs --out "C:\Users\...\YUKLEME_PAKETI" ^
 *     --api https://api.ornek.com --garson https://garson.ornek.com --menu https://qr.ornek.com --patron https://patron.ornek.com
 *
 * Gizli anahtarlar (APP_SECRET, KASA_API_KEY) ilk çalıştırmada üretilir, çıktı klasöründeki .anahtarlar.json'a yazılır (Git'e girmez)
 * ve sonraki çalıştırmalarda AYNEN yeniden kullanılır (kasaya girilen anahtar geçersiz kalmasın). Yenilemek için --yeni-anahtar verin.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
for (const k of ['out', 'api', 'garson', 'menu', 'patron']) if (!args[k]) { console.error('Eksik parametre: --' + k); process.exit(1); }
const clean = (u) => u.replace(/\/+$/, '');
const API_BASE = clean(args.api), GARSON = clean(args.garson), MENU = clean(args.menu), PATRON = clean(args.patron);
const apiIndex = API_BASE + '/index.php';

const web = path.resolve(__dirname, '..', 'cpanel-yuklenecekler');
const out = path.resolve(args.out);
const keyFile = path.join(out, '.anahtarlar.json');
let saved = null;
if (!process.argv.includes('--yeni-anahtar')) { try { saved = JSON.parse(fs.readFileSync(keyFile, 'utf8')); } catch (e) { saved = null; } }
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const tmp = path.join(out, '_hazirlik');

const appSecret = (saved && saved.appSecret) || crypto.randomBytes(32).toString('hex');
const kasaKey = (saved && saved.kasaKey) || crypto.randomBytes(24).toString('hex');
fs.writeFileSync(keyFile, JSON.stringify({ appSecret, kasaKey }));

function stage(name, from, tweak) {
  const dir = path.join(tmp, name);
  fs.cpSync(from, dir, { recursive: true, filter: (p) => !/config\.local\.php$|config\.local\.example\.php$/.test(p) });
  tweak && tweak(dir);
  return dir;
}
function zip(dir, zipPath) {
  // Standart zip (öneksiz, "/" ayraçlı yollar): Windows Gezgini ve cPanel Dosya Yöneticisi ile uyumlu.
  // (bsdtar'ın "./" önekli zip'leri Gezgin'de BOŞ görünür.)
  const py = [
    'import sys, os, zipfile',
    'src, dst = sys.argv[1], sys.argv[2]',
    'with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:',
    '    for r, _, fs in os.walk(src):',
    '        for f in fs:',
    '            p = os.path.join(r, f)',
    '            z.write(p, os.path.relpath(p, src).replace(os.sep, "/"))',
  ].join(String.fromCharCode(10));
  execFileSync('python', ['-c', py, dir, zipPath], { stdio: 'inherit' });
}
const setConfigJs = (dir) => fs.writeFileSync(path.join(dir, 'config.js'), `window.GTU_API_URL = '${apiIndex}';\n`);

stage('api', path.join(web, 'api'), (dir) => {
  fs.writeFileSync(
    path.join(dir, 'config.local.php'),
    `<?php
// SUNUCUYA YÜKLENİR. Git'e GİRMEZ. Başkasıyla paylaşmayın.
return [
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_NAME' => 'BURAYA_VERITABANI_ADI',
    'DB_USER' => 'BURAYA_VERITABANI_KULLANICI',
    'DB_PASS' => 'BURAYA_YENI_VERITABANI_PAROLASI',
    'APP_SECRET'   => '${appSecret}',
    'KASA_API_KEY' => '${kasaKey}',
    'BOSS_PASSWORD' => '',
    'GARSON_URL' => '${GARSON}',
];
`
  );
});
stage('garson', path.join(web, 'garson'), setConfigJs);
stage('menu', path.join(web, 'menu'), setConfigJs);
stage('patron', path.join(web, 'patron'), setConfigJs);

for (const [n, f] of [['api', '1-api'], ['garson', '2-garson'], ['menu', '3-qr-menu'], ['patron', '4-patron']]) zip(path.join(tmp, n), path.join(out, `${f}.zip`));
fs.rmSync(tmp, { recursive: true, force: true });

fs.writeFileSync(
  path.join(out, 'KASA-AYARLARI-GIZLI.txt'),
  `KASA PROGRAMINA GİRİLECEK BİLGİLER (Restoran & Donanım Ayarları > Bulut & Yedekleme)
Bu dosyayı kimseyle paylaşmayın.

Merkezi API adresi : ${apiIndex}
QR menü adresi     : ${MENU}
Kasa API anahtarı  : ${kasaKey}
`
);
console.log('Paketler hazır:', fs.readdirSync(out).join(', '));
