import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileLogger, maskSecrets } from '../electron/logger';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtu-log-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('günlük', () => {
  it('gizli değerleri maskeler', () => {
    const m = maskSecrets('istek X-Kasa-Key: abc123SECRET ve {"password":"Gizli9","pin":"4321"} authorization: Bearer eyJ.abc.def token=xyz');
    for (const secret of ['abc123SECRET', 'Gizli9', '4321', 'eyJ.abc.def', 'xyz']) expect(m, secret).not.toContain(secret);
    expect(m).toContain('***');
  });
  it('dosyaya yazar, hatayı yığınıyla kaydeder, gizli veri sızdırmaz', () => {
    const l = new FileLogger(dir);
    l.info('açıldı');
    l.error('çöktü', new Error('boom password=Gizli9'));
    const text = fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf8');
    expect(text).toContain('[INFO] açıldı');
    expect(text).toContain('[ERROR] çöktü');
    expect(text).toContain('boom');
    expect(text).not.toContain('Gizli9');
    expect(l.tail(5).length).toBeGreaterThan(0);
  });
  it('eski günlükleri siler, yenileri tutar', () => {
    const old = path.join(dir, 'kasa-2020-01-01.log');
    fs.writeFileSync(old, 'x');
    const past = new Date(Date.now() - 40 * 86400_000);
    fs.utimesSync(old, past, past);
    new FileLogger(dir).info('yeni');
    expect(fs.existsSync(old)).toBe(false);
    expect(fs.readdirSync(dir).length).toBe(1);
  });
  it('klasör yazılamasa bile istisna fırlatmaz', () => {
    const file = path.join(dir, 'dosya');
    fs.writeFileSync(file, 'x');
    expect(() => new FileLogger(path.join(file, 'alt')).error('x')).not.toThrow();
  });
});
