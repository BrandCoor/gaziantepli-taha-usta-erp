/**
 * cPanel'e yüklenen web sayfalarının (garson / menu / patron) CDN bağımlılığını kaldırır.
 * Üretilen dosyalar cpanel-yuklenecekler/assets/ altına yazılır ve Git'e eklenir
 * (hosting tarafında derleme yapılmaz; klasör olduğu gibi yüklenir).
 *
 * Kullanım:  npm run build:web
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'cpanel-yuklenecekler');
const out = path.join(web, 'assets');
const nm = (p) => path.join(root, 'node_modules', p);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fa', 'css'), { recursive: true });
fs.mkdirSync(path.join(out, 'fa', 'webfonts'), { recursive: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });

// 1) Tailwind (yalnızca sayfalarda gerçekten kullanılan sınıflar)
const input = path.join(out, '_in.css');
fs.writeFileSync(input, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
execFileSync(
  process.execPath,
  [nm('tailwindcss/lib/cli.js'), '-c', path.join(web, 'tailwind.web.config.cjs'), '-i', input, '-o', path.join(out, 'app.css'), '--minify'],
  { stdio: 'inherit', cwd: root }
);
fs.rmSync(input);

// 2) Font Awesome (css + yazı tipleri)
fs.copyFileSync(nm('@fortawesome/fontawesome-free/css/all.min.css'), path.join(out, 'fa', 'css', 'all.min.css'));
for (const f of fs.readdirSync(nm('@fortawesome/fontawesome-free/webfonts'))) {
  if (f.endsWith('.woff2')) fs.copyFileSync(nm('@fortawesome/fontawesome-free/webfonts/' + f), path.join(out, 'fa', 'webfonts', f));
}

// 3) Yazı tipleri (Türkçe karakterler için latin + latin-ext)
let fontsCss = '';
const jak = nm('@fontsource-variable/plus-jakarta-sans/files');
for (const f of fs.readdirSync(jak)) {
  if (/^plus-jakarta-sans-(latin|latin-ext)-wght-normal\.woff2$/.test(f)) fs.copyFileSync(path.join(jak, f), path.join(out, 'fonts', f));
}
const unicode = JSON.parse(fs.readFileSync(nm('@fontsource-variable/plus-jakarta-sans/unicode.json'), 'utf8'));
for (const subset of ['latin-ext', 'latin']) {
  fontsCss += `@font-face{font-family:"Plus Jakarta Sans";font-style:normal;font-display:swap;font-weight:200 800;src:url(./plus-jakarta-sans-${subset}-wght-normal.woff2) format("woff2-variations");unicode-range:${unicode[subset]};}\n`;
}
const pf = nm('@fontsource/playfair-display/files');
const pfUnicode = JSON.parse(fs.readFileSync(nm('@fontsource/playfair-display/unicode.json'), 'utf8'));
for (const style of ['normal', 'italic']) {
  for (const subset of ['latin-ext', 'latin']) {
    const f = `playfair-display-${subset}-700-${style}.woff2`;
    fs.copyFileSync(path.join(pf, f), path.join(out, 'fonts', f));
    fontsCss += `@font-face{font-family:"Playfair Display";font-style:${style};font-display:swap;font-weight:700;src:url(./${f}) format("woff2");unicode-range:${pfUnicode[subset]};}\n`;
  }
}
fs.writeFileSync(path.join(out, 'fonts', 'fonts.css'), fontsCss);

console.log('Web varlıkları üretildi:', out);
