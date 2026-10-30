import { describe, it, expect } from 'vitest';
import { buildBackup, applyBackup, validateBackup, isBackedUpKey, StorageLike } from '../src/services/fullBackup';

function mem(initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const m = new Map<string, string>(Object.entries(initial));
  return {
    get length() { return m.size; },
    key: (i) => Array.from(m.keys())[i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const sample = () => ({
  gtu_pos_products: JSON.stringify([{ id: 'p1' }, { id: 'p2' }]),
  gtu_pos_completed_orders: JSON.stringify([{ id: 'o1', totalAmount: 100 }, { id: 'o2', totalAmount: 50 }, { id: 'o3', totalAmount: 25 }]),
  gtu_erp_customers: JSON.stringify([{ id: 'c1', balance: 500 }]),
  gtu_erp_customer_transactions: JSON.stringify([{ id: 't1' }, { id: 't2' }]),
  gtu_pos_z_reports: JSON.stringify([{ id: 'z1', zNo: 1 }]),
  CUSTOM_API_SYNC_URL: 'https://ornek.com/api/index.php',
});

describe('tam yedek', () => {
  it('sırlar ve geçici veriler yedeğe GİRMEZ', () => {
    expect(isBackedUpKey('CUSTOM_KASA_API_KEY')).toBe(false);
    expect(isBackedUpKey('gtu_device_token')).toBe(false);
    expect(isBackedUpKey('gtu_boss_password')).toBe(false);
    expect(isBackedUpKey('gtu_print_queue_v1')).toBe(false);
    expect(isBackedUpKey('gtu_processed_incoming_ids')).toBe(false);
    expect(isBackedUpKey('baska_uygulama_verisi')).toBe(false);
    expect(isBackedUpKey('gtu_pos_tables')).toBe(true);
    expect(isBackedUpKey('CUSTOM_API_SYNC_URL')).toBe(true);
  });

  it('yedekle → veriyi boz → geri yükle: tüm kayıtlar ve sayılar geri gelir', () => {
    const live = mem({ ...sample(), CUSTOM_KASA_API_KEY: 'gizli' });
    const backup = buildBackup(live, '1.0.0');
    expect(backup.data['CUSTOM_KASA_API_KEY']).toBeUndefined();
    expect(backup.counts.tamamlanan_adisyonlar).toBe(3);
    expect(backup.counts.cari_hareketleri).toBe(2);

    // veri bozulur
    live.setItem('gtu_pos_completed_orders', '[]');
    live.removeItem('gtu_erp_customers');
    live.setItem('gtu_pos_z_reports', 'bozuk');

    const res = applyBackup(live, JSON.parse(JSON.stringify(backup)));
    expect(res.success).toBe(true);
    expect(res.mismatches).toEqual([]);
    expect(JSON.parse(live.getItem('gtu_pos_completed_orders')!)).toHaveLength(3);
    expect(JSON.parse(live.getItem('gtu_erp_customers')!)[0].balance).toBe(500);
    expect(JSON.parse(live.getItem('gtu_pos_z_reports')!)[0].zNo).toBe(1);
    expect(live.getItem('CUSTOM_KASA_API_KEY')).toBe('gizli'); // sır dokunulmadan kalır
  });

  it('geri yükleme yedekte olmayan eski yedeklenebilir anahtarları temizler (kalıntı yok)', () => {
    const live = mem(sample());
    const backup = buildBackup(live, '1.0.0');
    live.setItem('gtu_pos_hayalet_anahtar', 'x');
    applyBackup(live, backup);
    expect(live.getItem('gtu_pos_hayalet_anahtar')).toBeNull();
  });

  it('kayıt sayıları uyuşmazsa başarısız bildirilir (mutabakat)', () => {
    const live = mem(sample());
    const backup = buildBackup(live, '1.0.0');
    backup.counts.tamamlanan_adisyonlar = 99;
    const res = applyBackup(mem(), backup);
    expect(res.success).toBe(false);
    expect(res.mismatches).toContain('tamamlanan_adisyonlar');
  });

  it('geçersiz/yabancı/yeni sürüm dosyaları reddedilir', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ format: 'baska' }).ok).toBe(false);
    expect(validateBackup({ format: 'gtu-full-backup', version: 99, data: {} }).ok).toBe(false);
    expect(validateBackup({ format: 'gtu-full-backup', version: 1, data: { CUSTOM_KASA_API_KEY: 'x' } }).ok).toBe(false);
    expect(validateBackup({ format: 'gtu-full-backup', version: 1, data: { gtu_pos_tables: 5 } }).ok).toBe(false);
    expect(validateBackup(buildBackup(mem(sample()), '1')).ok).toBe(true);
  });
});
