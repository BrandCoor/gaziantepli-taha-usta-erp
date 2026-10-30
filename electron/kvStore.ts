/**
 * Kalıcı anahtar-değer deposu (SQLite, WAL, synchronous=FULL). Ana süreçte çalışır.
 *
 * Neden: Chromium localStorage yazmaları diske gecikmeli aktarır; elektrik kesintisi/çökmede son yazmalar
 * kaybolur. Burada her yazma bir SQLite işlemi olarak COMMIT edilir (fsync) ve çökmeye dayanıklıdır.
 * Arayüz hız için localStorage'ı önbellek olarak kullanmaya devam eder; asıl kaynak bu depodur.
 */
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

export interface KvInfo {
  path: string;
  keys: number;
  bytes: number;
  integrity: string;
  journalMode: string;
}

export class KvStore {
  private db: DatabaseSync;
  private stmtSet;
  private stmtDel;

  /** @param appSchemaVersion Bu uygulama sürümünün anladığı veri şeması. Veri daha YENİ bir sürümden geliyorsa açılmaz (sessiz bozulma olmasın). */
  constructor(private file: string, appSchemaVersion = 1) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = FULL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key        TEXT PRIMARY KEY NOT NULL,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    this.db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', ?)").run(String(appSchemaVersion));
    const stored = Number((this.db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string }).value) || 1;
    if (stored > appSchemaVersion) {
      this.db.close();
      throw new Error(`DATA_NEWER: veri şeması ${stored}, bu uygulama ${appSchemaVersion} sürümünü anlıyor. Uygulamayı güncelleyin; veriye dokunulmadı.`);
    }
    if (stored < appSchemaVersion) {
      // Gelecekteki şema göçleri burada, ÖNCE anlık görüntü alınarak çalıştırılır.
      this.db.prepare("UPDATE meta SET value = ? WHERE key = 'schema_version'").run(String(appSchemaVersion));
    }
    this.stmtSet = this.db.prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
    this.stmtDel = this.db.prepare('DELETE FROM kv WHERE key = ?');
  }

  getAll(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const row of this.db.prepare('SELECT key, value FROM kv').all() as Array<{ key: string; value: string }>) out[row.key] = row.value;
    return out;
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM kv').get() as { n: number }).n;
  }

  set(key: string, value: string): void {
    this.stmtSet.run(key, value, Date.now());
  }

  remove(key: string): void {
    this.stmtDel.run(key);
  }

  clear(): void {
    this.db.exec('DELETE FROM kv');
  }

  /** Birden çok kaydı TEK işlemde yazar (ya hepsi ya hiçbiri). */
  setMany(entries: Record<string, string>): number {
    let n = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const now = Date.now();
      for (const [k, v] of Object.entries(entries)) {
        this.stmtSet.run(k, v, now);
        n++;
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return n;
  }

  /** Tüm içeriği tek işlemde değiştirir (geri yükleme / ilk içe aktarma). */
  replaceAll(entries: Record<string, string>): number {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec('DELETE FROM kv');
      const now = Date.now();
      let n = 0;
      for (const [k, v] of Object.entries(entries)) {
        this.stmtSet.run(k, v, now);
        n++;
      }
      this.db.exec('COMMIT');
      return n;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  info(): KvInfo {
    const integrity = (this.db.prepare('PRAGMA integrity_check').get() as Record<string, string>) || {};
    const jm = (this.db.prepare('PRAGMA journal_mode').get() as Record<string, string>) || {};
    let bytes = 0;
    try { bytes = fs.statSync(this.file).size; } catch {}
    return {
      path: this.file,
      keys: this.count(),
      bytes,
      integrity: Object.values(integrity)[0] ?? '?',
      journalMode: Object.values(jm)[0] ?? '?',
    };
  }

  /** Tutarlı anlık kopya (çalışırken güvenli): VACUUM INTO. */
  snapshotTo(dest: string): void {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    this.db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  }

  close(): void {
    try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}
    this.db.close();
  }
}
