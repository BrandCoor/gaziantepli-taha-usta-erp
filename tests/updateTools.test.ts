import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const { verifyUpdateDir, publishUpdate, parseLatestYml, sha512b64, cmpVer } = require('../tools/update-tools.cjs');

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gtu-upd-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

/** Gerçek electron-builder çıktısı biçiminde, rastgele içerikli sahte yükleyici üretir (yalnızca test klasöründe). */
function makeRelease(dir: string, version: string) {
  fs.mkdirSync(dir, { recursive: true });
  const name = `GaziantepliTahaUsta-Kurulum-${version}.exe`;
  const bytes = crypto.randomBytes(200_000);
  fs.writeFileSync(path.join(dir, name), bytes);
  fs.writeFileSync(path.join(dir, name + '.blockmap'), crypto.randomBytes(500));
  const sha = crypto.createHash('sha512').update(bytes).digest('base64');
  fs.writeFileSync(path.join(dir, 'latest.yml'),
    `version: ${version}\nfiles:\n  - url: ${name}\n    sha512: ${sha}\n    size: ${bytes.length}\npath: ${name}\nsha512: ${sha}\nreleaseDate: '2026-10-30T10:00:00.000Z'\n`);
  return name;
}

describe('yayın araçları', () => {
  it('latest.yml ayrıştırılır', () => {
    const y = parseLatestYml("version: 1.2.3\nfiles:\n  - url: a.exe\n    sha512: AAA=\n    size: 10\npath: a.exe\nsha512: AAA=\n");
    expect(y.version).toBe('1.2.3');
    expect(y.files[0]).toMatchObject({ url: 'a.exe', sha512: 'AAA=', size: '10' });
  });

  it('sağlam yayın doğrulanır', () => {
    makeRelease(tmp, '1.1.0');
    expect(verifyUpdateDir(tmp)).toMatchObject({ ok: true, version: '1.1.0' });
  });

  it('BOZUK paket (tek bayt değişmiş) reddedilir', () => {
    const name = makeRelease(tmp, '1.1.0');
    const f = path.join(tmp, name);
    const b = fs.readFileSync(f); b[1000] ^= 0xff; fs.writeFileSync(f, b);
    const r = verifyUpdateDir(tmp);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/SHA-512 UYUŞMUYOR/);
  });

  it('eksik / kesik dosya reddedilir', () => {
    const name = makeRelease(tmp, '1.1.0');
    fs.truncateSync(path.join(tmp, name), 1000);
    expect(verifyUpdateDir(tmp).problems.join(' ')).toMatch(/boyut uyuşmuyor/);
    fs.rmSync(path.join(tmp, name));
    expect(verifyUpdateDir(tmp).problems.join(' ')).toMatch(/dosya yok/);
  });

  it('yayın üretir; politika + özet dosyaları yazılır; çıktı da doğrulanır', () => {
    const rel = path.join(tmp, 'release'); makeRelease(rel, '1.2.0');
    const out = path.join(tmp, 'out');
    const r = publishUpdate({ releaseDir: rel, outDir: out, previousVersion: '1.1.0', policy: { critical: true, minSupported: '1.1.0', deadline: '2026-12-31', notes: 'Güvenlik düzeltmesi' } });
    expect(r.version).toBe('1.2.0');
    const pol = JSON.parse(fs.readFileSync(path.join(out, 'guncelleme/update-policy.json'), 'utf8'));
    expect(pol).toMatchObject({ latest: '1.2.0', critical: true, minSupported: '1.1.0', deadline: '2026-12-31', notes: 'Güvenlik düzeltmesi' });
    expect(fs.readFileSync(path.join(out, 'guncelleme/SHA512SUMS.txt'), 'utf8')).toContain('GaziantepliTahaUsta-Kurulum-1.2.0.exe');
    expect(verifyUpdateDir(path.join(out, 'guncelleme')).ok).toBe(true);
  });

  it('bozuk kaynaktan yayın ÜRETİLMEZ; geri/aynı sürüm yayınlanamaz', () => {
    const rel = path.join(tmp, 'release'); const name = makeRelease(rel, '1.2.0');
    expect(() => publishUpdate({ releaseDir: rel, outDir: path.join(tmp, 'o1'), previousVersion: '1.2.0' })).toThrow(/büyük olmalı/);
    const b = fs.readFileSync(path.join(rel, name)); b[5] ^= 1; fs.writeFileSync(path.join(rel, name), b);
    expect(() => publishUpdate({ releaseDir: rel, outDir: path.join(tmp, 'o2') })).toThrow(/doğrulanamadı/);
    expect(fs.existsSync(path.join(tmp, 'o2/guncelleme'))).toBe(false);
  });

  it('özet hesabı electron-updater ile aynı (SHA-512 base64)', () => {
    const f = path.join(tmp, 'x.bin'); fs.writeFileSync(f, 'merhaba');
    expect(sha512b64(f)).toBe(crypto.createHash('sha512').update('merhaba').digest('base64'));
    expect(cmpVer('1.10.0', '1.9.0')).toBe(1);
  });
});
