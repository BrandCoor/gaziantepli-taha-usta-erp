import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const list = (zip: string): string[] =>
  JSON.parse(execFileSync('python', ['-c', 'import zipfile,sys,json;print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))', zip], { encoding: 'utf8' }));

const pack = (out: string, extra: string[] = []) =>
  execFileSync('node', ['tools/make-deploy-package.cjs', '--out', out, '--api', 'https://api.ornek.test', '--garson', 'https://garson.ornek.test', '--menu', 'https://qr.ornek.test', '--patron', 'https://patron.ornek.test', ...extra], { encoding: 'utf8' });

describe('dağıtım paketleri', () => {
  it('ilk kurulum: api zip config.local.php içerir; GÜNCELLEME paketi İÇERMEZ ve ilk kurulumu silmez', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gtu-pkg-'));
    try {
      pack(out);
      expect(list(path.join(out, '1-api.zip'))).toContain('config.local.php');
      const key = fs.readFileSync(path.join(out, '.anahtarlar.json'), 'utf8');
      pack(out, ['--update']);
      // ilk kurulum paketleri ve anahtarlar yerinde
      expect(fs.existsSync(path.join(out, '1-api.zip'))).toBe(true);
      expect(fs.readFileSync(path.join(out, '.anahtarlar.json'), 'utf8')).toBe(key);
      const upd = list(path.join(out, 'sunucu-guncelleme', '1-api-guncelleme.zip'));
      expect(upd).not.toContain('config.local.php'); // mevcut ayarlar/anahtarlar ezilmez
      expect(upd).toContain('version.php');
      expect(upd).toContain('index.php');
      expect(upd.some((f) => f.startsWith('_yedek'))).toBe(false);
      expect(fs.existsSync(path.join(out, 'sunucu-guncelleme', 'KASA-AYARLARI-GIZLI.txt'))).toBe(false);
      const garson = list(path.join(out, 'sunucu-guncelleme', '2-garson-guncelleme.zip'));
      expect(garson).toEqual(expect.arrayContaining(['sw.js', 'version.json', 'index.html']));
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  }, 60000);
});
