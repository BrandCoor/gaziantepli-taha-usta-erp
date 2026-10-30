import { buildBackup, applyBackup, validateBackup, RestoreResult } from './fullBackup';
import { isElectronApp, ipcInvoke } from './electronBridge';
import { restaurantDataService } from './restaurantDataService';

export interface BackupItem {
  name: string;
  size: number;
  modified: number;
  kind: string;
}

export interface AppInfo {
  version: string;
  userData: string;
  backupDir: string;
  secondaryDir: string | null;
}

const SIX_HOURS = 6 * 60 * 60 * 1000;
let schedulerStarted = false;
let lastAuto: { at: number; ok: boolean; message: string } | null = null;

/** Dosya yedeği yalnızca masaüstü uygulamasında mümkündür; tarayıcıda DÜRÜSTÇE "kullanılamaz" denir. */
export const fullBackupService = {
  isAvailable: (): boolean => isElectronApp(),

  getLastAuto: () => lastAuto,

  async appInfo(): Promise<AppInfo | null> {
    if (!isElectronApp()) return null;
    try { return await ipcInvoke('app-info'); } catch { return null; }
  },

  async backupNow(label = 'elle'): Promise<{ success: boolean; name?: string; path?: string; bytes?: number; verified?: boolean; counts?: Record<string, number>; error?: string }> {
    if (!isElectronApp()) return { success: false, error: 'Dosya yedeği yalnızca masaüstü uygulamasında çalışır.' };
    try {
      const info = await this.appInfo();
      const backup = buildBackup(localStorage, info?.version || 'bilinmiyor');
      const res = await ipcInvoke('backup-save', { label, json: JSON.stringify(backup) });
      return { ...res, counts: backup.counts };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Yedek alınamadı' };
    }
  },

  async list(): Promise<{ items: BackupItem[]; dir: string; secondaryDir: string | null } | null> {
    if (!isElectronApp()) return null;
    try {
      const r = await ipcInvoke('backup-list');
      return r?.success ? { items: r.items, dir: r.dir, secondaryDir: r.secondaryDir } : null;
    } catch { return null; }
  },

  openFolder: () => ipcInvoke('backup-open-folder'),
  chooseSecondary: () => ipcInvoke('backup-choose-secondary'),
  clearSecondary: () => ipcInvoke('backup-clear-secondary'),

  /**
   * Yedekten geri yükler. SIRA: (1) mevcut verinin yedeği (başarısızsa İPTAL), (2) uygulama, (3) sayı mutabakatı.
   * Mutabakat başarısızsa önceki durum otomatik geri yüklenir.
   */
  async restoreFromJson(jsonText: string): Promise<RestoreResult & { backupBefore?: string }> {
    let obj: any;
    try { obj = JSON.parse(jsonText); } catch { return fail('Dosya geçerli JSON değil'); }
    const v = validateBackup(obj);
    if (!v.ok) return fail(v.error);

    const before = await this.backupNow('geri-yukleme-oncesi');
    if (!before.success) return fail('Geri yüklemeden önce mevcut veri yedeklenemedi, işlem iptal edildi: ' + (before.error || ''));

    const snapshot = buildBackup(localStorage, 'rollback');
    const res = applyBackup(localStorage, v.backup);
    if (!res.success) {
      applyBackup(localStorage, snapshot); // otomatik geri alma
      return { ...res, success: false, error: (res.error || '') + ' — önceki veri geri yüklendi.', backupBefore: before.name };
    }
    return { ...res, backupBefore: before.name };
  },

  async restoreFromBackupFile(name: string) {
    if (!isElectronApp()) return fail('Yalnızca masaüstü uygulamasında');
    const r = await ipcInvoke('backup-read', { name });
    if (!r?.success) return fail(r?.error || 'Yedek okunamadı');
    return this.restoreFromJson(r.json);
  },

  /** Açılışta ve her 6 saatte bir otomatik yedek. */
  startScheduler() {
    if (schedulerStarted || !isElectronApp()) return;
    schedulerStarted = true;
    const run = async () => {
      const r = await this.backupNow('otomatik');
      lastAuto = { at: Date.now(), ok: !!r.success, message: r.success ? `Yedek alındı: ${r.name}` : (r.error || 'Başarısız') };
    };
    setTimeout(run, 30_000);
    setInterval(run, SIX_HOURS);
  },
};

function fail(error: string): RestoreResult & { backupBefore?: string } {
  return { success: false, error, expected: {}, actual: {}, mismatches: [] };
}

// Bulut çekme ve Z kapanışı öncesi/sonrası otomatik yedek kancası
restaurantDataService.autoBackupHook = (label: string) => fullBackupService.backupNow(label);
