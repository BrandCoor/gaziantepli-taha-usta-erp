import { isElectronApp, ipcInvoke } from './electronBridge';
import { restaurantDataService } from './restaurantDataService';
import { fullBackupService } from './fullBackupService';
import { isPaymentBusy } from './busyState';
import { APP_VERSION } from './appVersion';

export interface UpdateStatus {
  state: 'disabled' | 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error' | 'rejected';
  current: string;
  available?: string;
  kind: 'none' | 'normal' | 'critical';
  progress?: number;
  message?: string;
  notes?: string;
  critical?: boolean;
  deadline?: string;
  retryAt?: number;
  feedUrl?: string | null;
  feedSource?: string;
  lastCheckAt?: number;
}

export const workState = () => {
  let openOrders = 0;
  try { openOrders = restaurantDataService.getTables().filter((t: any) => t.order && (t.order.items || []).length > 0).length; } catch {}
  return { openOrders, paymentInProgress: isPaymentBusy() };
};

export const updateService = {
  available: () => isElectronApp(),
  async status(): Promise<UpdateStatus | null> {
    if (!isElectronApp()) return null;
    try { return await ipcInvoke('update-status'); } catch { return null; }
  },
  async check(): Promise<UpdateStatus | null> {
    if (!isElectronApp()) return null;
    try { return await ipcInvoke('update-check'); } catch { return null; }
  },
  async setFeed(url: string): Promise<{ ok: boolean; message: string }> {
    try { return await ipcInvoke('update-set-feed', { url }); } catch (e: any) { return { ok: false, message: e?.message || 'Kaydedilemedi' }; }
  },
  subscribe(cb: (s: UpdateStatus) => void): () => void {
    const api = (window as any).electronAPI;
    return api?.onUpdateStatus ? api.onUpdateStatus(cb) : () => {};
  },
  /** Önce dosya yedeği (başarısızsa KURMAZ), sonra güvenli anda kurulum. */
  async installNow(): Promise<{ ok: boolean; message: string }> {
    const w = workState();
    if (w.openOrders > 0 || w.paymentInProgress) {
      return { ok: false, message: w.paymentInProgress ? 'Devam eden ödeme işlemi var.' : `${w.openOrders} masada açık adisyon var; önce adisyonları kapatın.` };
    }
    const bk = await fullBackupService.backupNow('guncelleme-oncesi');
    if (!bk.success) return { ok: false, message: 'Güncelleme öncesi yedek alınamadı, kurulum durduruldu: ' + (bk.error || '') };
    try { return await ipcInvoke('update-install', w); } catch (e: any) { return { ok: false, message: e?.message || 'Kurulum başlatılamadı' }; }
  },
  currentVersion: APP_VERSION,
};
