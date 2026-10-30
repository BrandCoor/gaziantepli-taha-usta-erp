import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BackupStore, sanitizeLabel } from '../electron/backupStore';

let dir: string;
let dir2: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtu-yedek-'));
  dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gtu-yedek2-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(dir2, { recursive: true, force: true });
});

describe('BackupStore', () => {
  it('yedeği yazar, geri okuyup doğrular, .tmp artığı bırakmaz', () => {
    const s = new BackupStore([dir]);
    const r = s.save('elle', JSON.stringify({ a: 1 }));
    expect(r.success).toBe(true);
    expect(r.verified).toBe(true);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toHaveLength(0);
    expect(JSON.parse(fs.readFileSync(path.join(dir, r.name!), 'utf8'))).toEqual({ a: 1 });
  });

  it('geçersiz JSON yedek olarak yazılmaz', () => {
    const s = new BackupStore([dir]);
    expect(s.save('elle', '{bozuk').success).toBe(false);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it('ikincil klasöre de kopyalar', () => {
    const s = new BackupStore([dir, dir2]);
    const r = s.save('elle', '{"x":1}');
    expect(r.success).toBe(true);
    expect(fs.readdirSync(dir2).filter((f) => f.endsWith('.json'))).toHaveLength(1);
  });

  it('ikincil klasör yazılamasa bile birincil başarılı sayılır ve hata bildirilir', () => {
    const bad = path.join(dir, 'dosya.txt');
    fs.writeFileSync(bad, 'x');
    const s = new BackupStore([dir, path.join(bad, 'altklasor')]);
    const r = s.save('elle', '{"x":1}');
    expect(r.success).toBe(true);
    expect(r.error).toContain('İkincil');
  });

  it('listeler, okur; yol gezinmesi ve geçersiz adlar reddedilir', () => {
    const s = new BackupStore([dir]);
    const r = s.save('manuel', '{"k":2}');
    expect(s.list().map((x) => x.name)).toContain(r.name);
    expect(s.read(r.name!).success).toBe(true);
    for (const bad of ['../x.json', '..\\x.json', 'yedek_x.json', 'baska.txt', '/etc/passwd', 'yedek_20260101-000000_a/../../b.json']) {
      expect(s.read(bad).success, bad).toBe(false);
    }
  });

  it('döndürme: yalnızca otomatik yedekler budanır, elle yedekler asla silinmez', () => {
    let t = 0;
    const s = new BackupStore([dir], 3, () => new Date(2026, 0, 1, 0, 0, t++));
    for (let i = 0; i < 6; i++) s.save('otomatik', `{"i":${i}}`);
    s.save('elle', '{"el":1}');
    s.save('z-kapanis', '{"z":1}');
    const names = s.list().map((x) => x.kind);
    expect(names.filter((k) => k === 'otomatik')).toHaveLength(3);
    expect(names).toContain('elle');
    expect(names).toContain('z-kapanis');
  });

  it('etiket temizlenir (Türkçe karakter, özel karakter)', () => {
    expect(sanitizeLabel('Z Kapanış!')).toBe('z-kapanis');
    expect(sanitizeLabel('../../kötü')).toBe('kotu');
    expect(sanitizeLabel('')).toBe('elle');
  });
});
