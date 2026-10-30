import { execFileSync } from 'node:child_process';

export const API = process.env.TEST_API_URL;
export const KASA_KEY = process.env.TEST_KASA_KEY || 'test-only-kasa-key-0123456789abcdef';
const MARIA = process.env.TEST_MARIADB_BIN || 'C:/Program Files/MariaDB 13.0/bin/mariadb.exe';

/** Yalnızca izole TEST veritabanına SQL çalıştırır (taha_test, port 3307). */
export function testSql(sql: string): string {
  return execFileSync(MARIA, ['--protocol=tcp', '-h127.0.0.1', '-P3307', '-utaha_test', '-ptest_only_pw', 'taha_test', '-N', '-e', sql], { encoding: 'utf8' });
}

export async function call(action: string, opts: { body?: any; headers?: Record<string, string>; kasa?: boolean } = {}) {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (opts.kasa) headers['X-Kasa-Key'] = KASA_KEY;
  const r = await fetch(`${API}?action=${action}`, { method: opts.body ? 'POST' : 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let data: any = null;
  try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}

/** Test düzeni: 'Ana Salon' bölümü + 30 masa (sunucu artık varsayılan düzen üretmez). */
export function seedLayout() {
  const rows = Array.from({ length: 30 }, (_, i) => `('tbl-sec-salon-${i + 1}','sec-salon','Ana Salon ${i + 1}','EMPTY')`).join(',');
  testSql(`INSERT IGNORE INTO bolumler (id, ad, masa_sayisi, kapasite_kisi, sira) VALUES ('sec-salon','Ana Salon',30,4,1);
           INSERT IGNORE INTO masalar (id, bolum_id, ad, durum) VALUES ${rows};`);
}

export function seedWaiterAndProduct(waiterId: string, pin: string, productId: string, price: number) {
  seedLayout();
  testSql(`INSERT INTO personeller (id, ad, pin, rol, aktif) VALUES ('${waiterId}', 'Test Garson', '${pin}', 'WAITER', 1)
           ON DUPLICATE KEY UPDATE pin='${pin}', aktif=1, rol='WAITER', device_token_hash=NULL, pairing_secret=NULL, pairing_code_hash=NULL;
           DELETE FROM cihazlar WHERE waiter_id='${waiterId}';
           INSERT INTO kategoriler (id, ad) VALUES ('k-test','Test') ON DUPLICATE KEY UPDATE ad='Test';
           INSERT INTO urunler (id, kategori_id, ad, fiyat, aktif) VALUES ('${productId}','k-test','Test Urun',${price},1)
           ON DUPLICATE KEY UPDATE fiyat=${price}, aktif=1;
           DELETE FROM rate_limits;`);
}
