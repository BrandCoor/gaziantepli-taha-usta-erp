import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { KvStore } from '../electron/kvStore';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtu-kv-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('KvStore (SQLite)', () => {
  it('yazar, okur, günceller, siler', () => {
    const s = new KvStore(path.join(dir, 'a.db'));
    s.set('a', '1'); s.set('b', '2'); s.set('a', '3');
    expect(s.getAll()).toEqual({ a: '3', b: '2' });
    s.remove('b');
    expect(s.getAll()).toEqual({ a: '3' });
    expect(s.count()).toBe(1);
    s.close();
  });

  it('kapanıp açılınca veri kalır (WAL + FULL)', () => {
    const f = path.join(dir, 'b.db');
    const s = new KvStore(f);
    s.set('siparis', JSON.stringify([{ id: 1 }]));
    s.close();
    const s2 = new KvStore(f);
    expect(JSON.parse(s2.getAll().siparis)).toEqual([{ id: 1 }]);
    const info = s2.info();
    expect(info.integrity).toBe('ok');
    expect(info.journalMode).toBe('wal');
    s2.close();
  });

  it('SÜREÇ ZORLA ÖLDÜRÜLSE BİLE işlenmiş yazmalar kaybolmaz (çökme dayanıklılığı)', () => {
    const f = path.join(dir, 'c.db').replace(/\\/g, '/');
    const script = `
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync('${f}');
      db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);');
      const st = db.prepare('INSERT INTO kv VALUES (?,?,?)');
      for (let i = 0; i < 50; i++) st.run('k'+i, 'v'+i, Date.now());
      process.kill(process.pid, 'SIGKILL');
    `;
    try { execFileSync(process.execPath, ['-e', script], { stdio: 'ignore' }); } catch { /* öldürüldü */ }
    const s = new KvStore(path.join(dir, 'c.db'));
    expect(s.count()).toBe(50);
    expect(s.getAll().k49).toBe('v49');
    expect(s.info().integrity).toBe('ok');
    s.close();
  });

  it('setMany tek işlemdir: hata olursa HİÇBİRİ yazılmaz', () => {
    const s = new KvStore(path.join(dir, 'd.db'));
    s.set('mevcut', 'x');
    expect(() => s.setMany({ a: '1', b: null as any })).toThrow();
    expect(s.getAll()).toEqual({ mevcut: 'x' });
    s.close();
  });

  it('replaceAll içeriği atomik değiştirir', () => {
    const s = new KvStore(path.join(dir, 'e.db'));
    s.set('eski', '1');
    expect(s.replaceAll({ yeni1: 'a', yeni2: 'b' })).toBe(2);
    expect(s.getAll()).toEqual({ yeni1: 'a', yeni2: 'b' });
    expect(() => s.replaceAll({ x: '1', y: undefined as any })).toThrow();
    expect(s.getAll()).toEqual({ yeni1: 'a', yeni2: 'b' }); // geri alındı
    s.close();
  });

  it('snapshotTo çalışırken tutarlı kopya üretir ve açılabilir', () => {
    const s = new KvStore(path.join(dir, 'f.db'));
    s.set('a', '1'); s.set('b', '2');
    const snap = path.join(dir, 'snap', 'kopya.db');
    s.snapshotTo(snap);
    const copy = new KvStore(snap);
    expect(copy.getAll()).toEqual({ a: '1', b: '2' });
    copy.close(); s.close();
  });

  it('büyük değerleri (1 MB) saklar', () => {
    const s = new KvStore(path.join(dir, 'g.db'));
    const big = 'x'.repeat(1_000_000);
    s.set('buyuk', big);
    expect(s.getAll().buyuk.length).toBe(1_000_000);
    s.close();
  });
});
