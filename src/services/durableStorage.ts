/**
 * Dayanıklı depolama köprüsü (yalnızca masaüstü uygulamasında).
 *
 *  - Açılışta SQLite deposundaki (ana süreç) veri localStorage'a yüklenir; SQLite ASIL kaynaktır.
 *  - SQLite boşsa (ilk çalıştırma / eski sürümden geçiş) mevcut localStorage içeriği TEK işlemde içe aktarılır.
 *  - Sonrasında her localStorage.setItem/removeItem/clear aynı anda SQLite'a işlenir (sıralı).
 *
 * Böylece uygulama kodu değişmeden (hızlı, eşzamanlı localStorage) kalır, ancak veri çökmeye dayanıklı olur.
 */
import { isElectronApp, ipcInvoke } from './electronBridge';

export type DurableStatus = {
  mode: 'sqlite' | 'local-only';
  healthy: boolean;
  lastError?: string;
  imported?: number;
  loaded?: number;
  path?: string;
};

let status: DurableStatus = { mode: 'local-only', healthy: true };
const listeners = new Set<() => void>();
export const getDurableStatus = () => status;
export const onDurableStatus = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const setStatus = (s: Partial<DurableStatus>) => { status = { ...status, ...s }; listeners.forEach((l) => l()); };

let chain: Promise<unknown> = Promise.resolve();
function mirror(channel: string, payload: unknown) {
  // IPC çağrıları sırayla işlenir; zincir sıralamayı da hata yönetimini de korur.
  chain = chain
    .then(() => ipcInvoke(channel, payload))
    .then((r) => { if (r && r.success === false) throw new Error(r.error || 'kv hata'); })
    .catch((e) => setStatus({ healthy: false, lastError: String(e?.message || e) }));
}

export async function bootstrapDurableStorage(): Promise<DurableStatus> {
  if (!isElectronApp()) return status;
  try {
    const orig = {
      set: Storage.prototype.setItem,
      remove: Storage.prototype.removeItem,
      clear: Storage.prototype.clear,
    };
    const r = await ipcInvoke('kv-load-all');
    if (!r?.success) throw new Error(r?.error || 'Depo okunamadı');
    const dbEntries: Record<string, string> = r.entries || {};

    if (Object.keys(dbEntries).length > 0) {
      // SQLite asıl kaynak: localStorage içeriğini ona eşitle
      orig.clear.call(localStorage);
      for (const [k, v] of Object.entries(dbEntries)) orig.set.call(localStorage, k, v);
      setStatus({ loaded: Object.keys(dbEntries).length });
    } else {
      // İlk çalıştırma / eski sürümden geçiş: mevcut localStorage'ı tek işlemde içe aktar
      const entries: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) entries[k] = localStorage.getItem(k) as string;
      }
      if (Object.keys(entries).length > 0) {
        const imp = await ipcInvoke('kv-import', { entries });
        if (!imp?.success) throw new Error(imp?.error || 'İçe aktarma başarısız');
        setStatus({ imported: imp.count });
      }
    }

    // Bundan sonra her yazma SQLite'a da işlenir
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      orig.set.call(this, key, value);
      if (this === window.localStorage) mirror('kv-set', { key: String(key), value: String(value) });
    };
    Storage.prototype.removeItem = function (this: Storage, key: string) {
      orig.remove.call(this, key);
      if (this === window.localStorage) mirror('kv-remove', { key: String(key) });
    };
    Storage.prototype.clear = function (this: Storage) {
      orig.clear.call(this);
      if (this === window.localStorage) mirror('kv-clear', {});
    };

    const info = await ipcInvoke('kv-info').catch(() => null);
    setStatus({ mode: 'sqlite', healthy: true, path: info?.path });
  } catch (e: any) {
    // Depo açılamazsa uygulama localStorage ile devam eder ama durum DÜRÜSTÇE "sağlıksız" gösterilir.
    setStatus({ mode: 'local-only', healthy: false, lastError: String(e?.message || e) });
  }
  return status;
}
