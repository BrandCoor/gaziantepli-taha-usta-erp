/**
 * Tam yedek (saf mantık). Tüm işletme verisi tek JSON'da toplanır; geri yüklemede sayılar doğrulanır.
 * localStorage'dan bağımsız test edilebilsin diye depolama arayüzü dışarıdan verilir.
 */
export interface StorageLike {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const BACKUP_FORMAT = 'gtu-full-backup';
export const BACKUP_VERSION = 1;

/** Yedeğe girmeyen anahtarlar: sırlar ve geçici/önbellek verisi. */
const SECRET_RE = /(key|token|secret|password)/i;
const TRANSIENT = new Set(['gtu_processed_incoming_ids', 'gtu_print_queue_v1', 'gtu_safety_snapshot']);

export function isBackedUpKey(k: string): boolean {
  if (!/^(gtu|GTU|CUSTOM_|QR_)/.test(k)) return false;
  if (TRANSIENT.has(k)) return false;
  if (SECRET_RE.test(k)) return false;
  return true;
}

export interface FullBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  appVersion: string;
  counts: Record<string, number>;
  data: Record<string, string>;
}

/** Önemli koleksiyonların kayıt sayıları (geri yükleme mutabakatı için). */
const COUNTED_KEYS: Record<string, string> = {
  gtu_pos_tables: 'masalar',
  gtu_pos_products: 'urunler',
  gtu_pos_categories: 'kategoriler',
  gtu_pos_waiters: 'garsonlar',
  gtu_pos_completed_orders: 'tamamlanan_adisyonlar',
  gtu_pos_z_reports: 'z_raporlari',
  gtu_pos_cancel_logs: 'iptal_kayitlari',
  gtu_erp_customers: 'musteriler',
  gtu_erp_customer_transactions: 'cari_hareketleri',
  gtu_erp_suppliers: 'toptancilar',
  gtu_erp_supplier_transactions: 'toptanci_hareketleri',
  gtu_erp_employees: 'personel',
  gtu_erp_expenses: 'giderler',
};

function countOf(raw: string | null): number {
  if (!raw) return 0;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

export function computeCounts(get: (k: string) => string | null): Record<string, number> {
  const out: Record<string, number> = {};
  Object.entries(COUNTED_KEYS).forEach(([k, label]) => (out[label] = countOf(get(k))));
  return out;
}

export function buildBackup(storage: StorageLike, appVersion: string, now: Date = new Date()): FullBackup {
  const data: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && isBackedUpKey(k)) {
      const v = storage.getItem(k);
      if (v !== null) data[k] = v;
    }
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now.toISOString(), appVersion, counts: computeCounts((k) => data[k] ?? null), data };
}

export function validateBackup(obj: any): { ok: true; backup: FullBackup } | { ok: false; error: string } {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'Dosya bir yedek değil' };
  if (obj.format !== BACKUP_FORMAT) return { ok: false, error: 'Bu dosya tam yedek biçiminde değil' };
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) return { ok: false, error: `Desteklenmeyen yedek sürümü (${obj.version})` };
  if (!obj.data || typeof obj.data !== 'object') return { ok: false, error: 'Yedek verisi eksik' };
  for (const [k, v] of Object.entries(obj.data)) {
    if (!isBackedUpKey(k)) return { ok: false, error: `Yedekte izin verilmeyen anahtar: ${k}` };
    if (typeof v !== 'string') return { ok: false, error: `Geçersiz değer: ${k}` };
  }
  return { ok: true, backup: obj as FullBackup };
}

export interface RestoreResult {
  success: boolean;
  error?: string;
  expected: Record<string, number>;
  actual: Record<string, number>;
  mismatches: string[];
}

/**
 * Yedeği uygular: mevcut (yedeklenebilir) anahtarlar temizlenir, yedekteki değerler yazılır.
 * Sonra kayıt sayıları yedekteki sayılarla karşılaştırılır (mutabakat).
 * NOT: Çağıran taraf, geri yüklemeden ÖNCE mevcut verinin yedeğini almış olmalıdır.
 */
export function applyBackup(storage: StorageLike, backup: FullBackup): RestoreResult {
  const existing: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && isBackedUpKey(k)) existing.push(k);
  }
  existing.forEach((k) => storage.removeItem(k));
  Object.entries(backup.data).forEach(([k, v]) => storage.setItem(k, v));

  const expected = backup.counts && Object.keys(backup.counts).length ? backup.counts : computeCounts((k) => backup.data[k] ?? null);
  const actual = computeCounts((k) => storage.getItem(k));
  const mismatches = Object.keys(expected).filter((k) => expected[k] !== actual[k]);
  return { success: mismatches.length === 0, error: mismatches.length ? `Kayıt sayıları uyuşmuyor: ${mismatches.join(', ')}` : undefined, expected, actual, mismatches };
}
