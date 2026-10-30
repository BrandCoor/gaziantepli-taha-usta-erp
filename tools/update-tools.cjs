/**
 * Güncelleme yayın araçları (saf Node; test edilebilir).
 *  - parseLatestYml / verifyUpdateDir : latest.yml ↔ gerçek dosya SHA-512 + boyut doğrulaması (electron-updater ile aynı kural)
 *  - publishUpdate                    : release/ çıktısını doğrulayıp sunucuya yüklenecek "guncelleme" klasörünü üretir
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function sha512b64(file) {
  const h = crypto.createHash('sha512');
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(1 << 20);
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  } finally { fs.closeSync(fd); }
  return h.digest('base64');
}

/** electron-builder'ın ürettiği basit latest.yml için asgari ayrıştırıcı (bağımlılık yok). */
function parseLatestYml(text) {
  const out = { files: [] };
  let cur = null, inFiles = false;
  for (const raw of String(text).split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const top = /^([A-Za-z]+):\s*(.*)$/.exec(raw);
    if (top && !raw.startsWith(' ')) {
      inFiles = top[1] === 'files';
      if (!inFiles) out[top[1]] = top[2].replace(/^['"]|['"]$/g, '');
      continue;
    }
    if (inFiles) {
      const item = /^\s*-\s+url:\s*(.*)$/.exec(raw);
      if (item) { cur = { url: item[1].replace(/^['"]|['"]$/g, '') }; out.files.push(cur); continue; }
      const kv = /^\s+([A-Za-z0-9]+):\s*(.*)$/.exec(raw);
      if (kv && cur) cur[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '');
    }
  }
  if (out.files[0] && !out.path) out.path = out.files[0].url;
  return out;
}

/** dir içindeki latest.yml'deki her dosya gerçekten var mı, boyutu ve SHA-512'si tutuyor mu? */
function verifyUpdateDir(dir) {
  const problems = [];
  const ymlFile = path.join(dir, 'latest.yml');
  if (!fs.existsSync(ymlFile)) return { ok: false, problems: ['latest.yml yok'] };
  const y = parseLatestYml(fs.readFileSync(ymlFile, 'utf8'));
  if (!/^\d+\.\d+\.\d+/.test(y.version || '')) problems.push('latest.yml: geçersiz sürüm');
  if (!y.files.length) problems.push('latest.yml: files listesi boş');
  for (const f of y.files) {
    const p = path.join(dir, f.url);
    if (!fs.existsSync(p)) { problems.push(`dosya yok: ${f.url}`); continue; }
    if (f.size && Number(f.size) !== fs.statSync(p).size) problems.push(`boyut uyuşmuyor: ${f.url}`);
    if (!f.sha512) problems.push(`sha512 yok: ${f.url}`);
    else if (sha512b64(p) !== f.sha512) problems.push(`SHA-512 UYUŞMUYOR: ${f.url}`);
  }
  if (y.sha512 && y.path && fs.existsSync(path.join(dir, y.path)) && sha512b64(path.join(dir, y.path)) !== y.sha512) problems.push('üst düzey sha512 uyuşmuyor');
  return { ok: problems.length === 0, problems, version: y.version, files: y.files.map((f) => f.url) };
}

function cmpVer(a, b) {
  const p = (v) => String(v).split(/[.+-]/).slice(0, 3).map(Number);
  const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1;
  return 0;
}

/**
 * releaseDir (electron-builder çıktısı) → outDir/guncelleme. Önce kaynağı doğrular; bozuksa YAYIN ÜRETMEZ.
 * policy: { critical, minSupported, deadline, notes, minApi }
 */
function publishUpdate({ releaseDir, outDir, policy = {}, previousVersion }) {
  const pre = verifyUpdateDir(releaseDir);
  if (!pre.ok) throw new Error('Kaynak yayın doğrulanamadı: ' + pre.problems.join('; '));
  if (previousVersion && cmpVer(pre.version, previousVersion) <= 0) throw new Error(`Yeni sürüm (${pre.version}) önceki sürümden (${previousVersion}) büyük olmalı.`);
  const dest = path.join(outDir, 'guncelleme');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const y = parseLatestYml(fs.readFileSync(path.join(releaseDir, 'latest.yml'), 'utf8'));
  const copy = [...y.files.map((f) => f.url)];
  for (const f of [...copy]) if (fs.existsSync(path.join(releaseDir, f + '.blockmap'))) copy.push(f + '.blockmap');
  for (const f of copy) fs.copyFileSync(path.join(releaseDir, f), path.join(dest, f));
  fs.copyFileSync(path.join(releaseDir, 'latest.yml'), path.join(dest, 'latest.yml'));

  const pol = { latest: pre.version };
  if (policy.critical) pol.critical = true;
  if (policy.minSupported) pol.minSupported = policy.minSupported;
  if (policy.deadline) pol.deadline = policy.deadline;
  if (policy.minApi) pol.minApi = policy.minApi;
  if (policy.notes) pol.notes = String(policy.notes).slice(0, 4000);
  fs.writeFileSync(path.join(dest, 'update-policy.json'), JSON.stringify(pol, null, 2) + '\n');

  const sums = copy.filter((f) => !f.endsWith('.blockmap')).map((f) => `${sha512b64(path.join(dest, f))}  ${f}`).join('\n');
  fs.writeFileSync(path.join(dest, 'SHA512SUMS.txt'), sums + '\n');

  const post = verifyUpdateDir(dest);
  if (!post.ok) throw new Error('Üretilen yayın klasörü doğrulanamadı: ' + post.problems.join('; '));
  return { dir: dest, version: pre.version, files: [...copy, 'latest.yml', 'update-policy.json', 'SHA512SUMS.txt'] };
}

module.exports = { sha512b64, parseLatestYml, verifyUpdateDir, publishUpdate, cmpVer };

if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
  if (args.verify) {
    const r = verifyUpdateDir(path.resolve(args.verify));
    console.log(r.ok ? `DOĞRULANDI: sürüm ${r.version} (${r.files.join(', ')})` : 'HATA: ' + r.problems.join('; '));
    process.exit(r.ok ? 0 : 1);
  }
  if (!args.out) { console.error('Kullanım: node tools/update-tools.cjs --out <klasör> [--release release] [--critical] [--min-supported 1.0.5] [--deadline 2026-12-31] [--notes "metin" | --notes-file dosya] [--previous 1.0.0]\n        node tools/update-tools.cjs --verify <klasör>'); process.exit(1); }
  try {
    const notes = args['notes-file'] ? fs.readFileSync(args['notes-file'], 'utf8') : (typeof args.notes === 'string' ? args.notes : undefined);
    const r = publishUpdate({
      releaseDir: path.resolve(args.release || 'release'), outDir: path.resolve(args.out), previousVersion: typeof args.previous === 'string' ? args.previous : undefined,
      policy: { critical: !!args.critical, minSupported: args['min-supported'], deadline: args.deadline, minApi: args['min-api'], notes },
    });
    console.log(`Yayın hazır: ${r.dir}\nSürüm ${r.version}\nSunucuda ${'<API>/updates/'} klasörüne YÜKLENECEK dosyalar: ${r.files.join(', ')}`);
  } catch (e) { console.error('HATA: ' + e.message); process.exit(1); }
}
