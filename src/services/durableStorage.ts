/**
 * Dayanıklı depolama köprüsü (yalnızca masaüstü uygulamasında).
 *
 * `window.localStorage`, ana süreçteki SQLite deposuna bağlı, bellekte çalışan bir depoyla DEĞİŞTİRİLİR:
 *  - Okumalar eşzamanlı ve hızlıdır (uygulama kodu değişmez).
 *  - Her yazma/silme anında SQLite'a (WAL, synchronous=FULL) işlenir → çökmeye dayanıklıdır.
 *  - Chromium'un ~5-10 MB localStorage KOTASI ve gecikmeli diske yazma sorunu ortadan kalkar.
 *
 * Açılışta: SQLite doluysa ASIL KAYNAK odur. Boşsa (ilk çalıştırma / eski sürümden geçiş) Chromium'un
 * eski localStorage içeriği TEK işlemde içe aktarılır (eski içerik silinmez, geri dönüş için yerinde kalır).
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

/** Yazmaları dışarıya (SQLite'a) bildiren, bellek tabanlı Storage uygulaması. */
export class MirroredStorage {
  private map = new Map<string, string>();

  constructor(
    initial: Record<string, string>,
    private hooks: { onSet(k: string, v: string): void; onRemove(k: string): void; onClear(): void }
  ) {
    Object.entries(initial).forEach(([k, v]) => this.map.set(k, v));
  }

  get length(): number { return this.map.size; }
  keysList(): string[] { return Array.from(this.map.keys()); }
  key(i: number): string | null { return this.keysList()[i] ?? null; }
  getItem(k: string): string | null { const key = String(k); return this.map.has(key) ? (this.map.get(key) as string) : null; }
  setItem(k: string, v: string): void {
    const key = String(k);
    const val = String(v);
    this.map.set(key, val);
    this.hooks.onSet(key, val);
  }
  removeItem(k: string): void {
    const key = String(k);
    if (this.map.delete(key)) this.hooks.onRemove(key);
  }
  clear(): void {
    this.map.clear();
    this.hooks.onClear();
  }
}

/** `localStorage.anahtar`, `'x' in localStorage`, `Object.keys(localStorage)`, `delete localStorage.x` desteği. */
export function asStorageProxy(s: MirroredStorage): Storage {
  const methods = new Set(['getItem', 'setItem', 'removeItem', 'clear', 'key']);
  return new Proxy(s as any, {
    get(t, p) {
      if (p === 'length') return t.length;
      if (typeof p === 'string' && methods.has(p)) return (t as any)[p].bind(t);
      if (typeof p === 'string') { const v = t.getItem(p); return v === null ? undefined : v; }
      return undefined;
    },
    set(t, p, v) { if (typeof p === 'string') { t.setItem(p, v); return true; } return false; },
    deleteProperty(t, p) { if (typeof p === 'string') { t.removeItem(p); return true; } return false; },
    has(t, p) { return typeof p === 'string' && (methods.has(p) || p === 'length' || t.getItem(p) !== null); },
    ownKeys(t) { return t.keysList(); },
    getOwnPropertyDescriptor(t, p) {
      if (typeof p === 'string') { const v = t.getItem(p); if (v !== null) return { value: v, writable: true, enumerable: true, configurable: true }; }
      return undefined;
    },
  }) as Storage;
}

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
    const legacy = window.localStorage; // Chromium'un gerçek deposu (eski veri)
    const r = await ipcInvoke('kv-load-all');
    if (!r?.success) throw new Error(r?.error || 'Depo okunamadı');
    let entries: Record<string, string> = r.entries || {};

    if (Object.keys(entries).length > 0) {
      setStatus({ loaded: Object.keys(entries).length });
    } else {
      // İlk çalıştırma / eski sürümden geçiş: mevcut localStorage'ı tek işlemde içe aktar
      const legacyEntries: Record<string, string> = {};
      for (let i = 0; i < legacy.length; i++) {
        const k = legacy.key(i);
        if (k) legacyEntries[k] = legacy.getItem(k) as string;
      }
      if (Object.keys(legacyEntries).length > 0) {
        const imp = await ipcInvoke('kv-import', { entries: legacyEntries });
        if (!imp?.success) throw new Error(imp?.error || 'İçe aktarma başarısız');
        entries = legacyEntries;
        setStatus({ imported: imp.count });
      }
    }

    const store = new MirroredStorage(entries, {
      onSet: (key, value) => mirror('kv-set', { key, value }),
      onRemove: (key) => mirror('kv-remove', { key }),
      onClear: () => mirror('kv-clear', {}),
    });
    (window as any).__chromiumLocalStorage = legacy; // yalnızca tanılama/geri dönüş için
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => asStorageProxy(store) });

    const info = await ipcInvoke('kv-info').catch(() => null);
    setStatus({ mode: 'sqlite', healthy: true, path: info?.path });
  } catch (e: any) {
    // Depo açılamazsa uygulama Chromium localStorage ile devam eder ama durum DÜRÜSTÇE "sağlıksız" gösterilir.
    setStatus({ mode: 'local-only', healthy: false, lastError: String(e?.message || e) });
  }
  return status;
}
