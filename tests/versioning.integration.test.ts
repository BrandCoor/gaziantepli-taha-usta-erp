// Sürüm uyumluluğu + şema göçü güvenceleri: GERÇEK PHP + MySQL (izole test veritabanı). TEST_API_URL gerekir.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { API, call, testSql } from './helpers/apiTestKit';

const run = API ? describe : describe.skip;
const BACKUP_DIR = path.resolve(__dirname, '../cpanel-yuklenecekler/api/_yedek');

run('sürüm uyumluluğu', () => {
  it('version ucu herkese açık ve gizli bilgi içermez', async () => {
    const r = await call('version');
    expect(r.status).toBe(200);
    expect(r.data.apiVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(r.data.schemaVersion).toBe(r.data.schemaExpected);
    expect(r.data.migrationError).toBe(false);
    expect(JSON.stringify(r.data)).not.toMatch(/key|secret|pass/i);
  });

  it('çok eski kasa 426 ile reddedilir ve HİÇBİR işlem yapılmaz', async () => {
    const r = await call('get_live_state', { kasa: true, headers: { 'X-Client-Type': 'kasa', 'X-Client-Version': '0.9.0' } });
    expect(r.status).toBe(426);
    expect(r.data.code).toBe('CLIENT_TOO_OLD');
    expect(r.data.error).toMatch(/güncelleyin/i);
  });

  it('çok eski garson sipariş gönderemez (426), sipariş kaydı oluşmaz', async () => {
    const before = testSql('SELECT COUNT(*) FROM siparisler').trim();
    const r = await call('send_order', { kasa: true, headers: { 'X-Client-Type': 'garson', 'X-Client-Version': '0.1.0' }, body: { tableId: 'x', items: [{ productId: 'x', quantity: 1 }], clientOrderId: 'old-client-1' } });
    expect(r.status).toBe(426);
    expect(testSql('SELECT COUNT(*) FROM siparisler').trim()).toBe(before);
  });

  it('desteklenen sürüm ve başlıksız (eski) istemci kabul edilir', async () => {
    const ok = await call('get_live_state', { kasa: true, headers: { 'X-Client-Type': 'kasa', 'X-Client-Version': '1.0.0' } });
    expect(ok.status).toBe(200);
    const legacy = await call('get_live_state', { kasa: true });
    expect(legacy.status).toBe(200);
  });

  it('sürüm ucu ve sağlık ucu eski istemciye de yanıt verir (uyarı gösterebilsin)', async () => {
    const r = await call('version', { headers: { 'X-Client-Type': 'kasa', 'X-Client-Version': '0.0.1' } });
    expect(r.status).toBe(200);
  });
});

run('şema göçü güvenceleri', () => {
  const clean = () => { try { fs.rmSync(BACKUP_DIR, { recursive: true, force: true }); } catch {} };
  beforeAll(clean);
  afterAll(() => {
    clean();
    testSql("INSERT INTO ayarlar (anahtar, deger, aciklama) VALUES ('schema_version','2','x') ON DUPLICATE KEY UPDATE deger='2'");
  });

  it('göç öncesi SQL yedeği alınır, göç tekrar çalıştırılınca veri korunur (idempotent)', async () => {
    testSql("INSERT INTO ayarlar (anahtar, deger, aciklama) VALUES ('gecis_test','korunmali','t') ON DUPLICATE KEY UPDATE deger='korunmali'");
    testSql("INSERT INTO ayarlar (anahtar, deger, aciklama) VALUES ('schema_version','1','x') ON DUPLICATE KEY UPDATE deger='1'");
    const r = await call('version'); // her istek ensureDatabaseTables → göç
    expect(r.data.schemaVersion).toBe(r.data.schemaExpected);
    const files = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sql.gz')) : [];
    expect(files.length).toBeGreaterThan(0);
    const sql = require('node:zlib').gunzipSync(fs.readFileSync(path.join(BACKUP_DIR, files[0]))).toString('utf8');
    expect(sql).toContain('gecis_test');
    expect(sql).toContain('-- SON');
    expect(testSql("SELECT deger FROM ayarlar WHERE anahtar='gecis_test'").trim()).toBe('korunmali');
    // yedek klasörü web'den okunamaz
    expect(fs.readFileSync(path.join(BACKUP_DIR, '.htaccess'), 'utf8')).toMatch(/denied|Deny/i);
  });

  it('göç başarısız olursa sürüm ARTIRILMAZ, hata kaydedilir, veri bozulmaz', async () => {
    testSql("INSERT INTO ayarlar (anahtar, deger, aciklama) VALUES ('schema_version','1','x') ON DUPLICATE KEY UPDATE deger='1'");
    // online_orders yerine VIEW koy: CREATE IF NOT EXISTS atlanır, v2'deki ALTER TABLE ise 1347 ile başarısız olur.
    testSql('RENAME TABLE online_orders TO online_orders_gecici');
    testSql('CREATE VIEW online_orders AS SELECT * FROM online_orders_gecici');
    try {
      const r = await call('version');
      expect(r.data.schemaVersion).toBe(1);
      expect(r.data.migrationError).toBe(true);
      expect(testSql("SELECT deger FROM ayarlar WHERE anahtar='schema_last_error'")).toMatch(/Göç v2/);
      expect(testSql("SELECT deger FROM ayarlar WHERE anahtar='gecis_test'").trim()).toBe('korunmali');
    } finally {
      testSql('DROP VIEW IF EXISTS online_orders');
      testSql('RENAME TABLE online_orders_gecici TO online_orders');
    }
    // düzelince göç tamamlanır ve hata temizlenir
    const ok = await call('version');
    expect(ok.data.schemaVersion).toBe(ok.data.schemaExpected);
    expect(ok.data.migrationError).toBe(false);
  });
});
