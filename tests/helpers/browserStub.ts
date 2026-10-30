import { vi } from 'vitest';

/** Servis katmanını Node'da çalıştırmak için izole sahte tarayıcı ortamı (localStorage). Gerçek veriye dokunmaz. */
export function stubBrowser() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  (globalThis as any).window = (globalThis as any).window || { addEventListener() {}, removeEventListener() {}, location: { hostname: 'localhost', protocol: 'http:' } };
  (globalThis as any).document = (globalThis as any).document || { createElement: () => ({}), addEventListener() {}, body: { appendChild() {} } };
  (globalThis as any).BroadcastChannel = (globalThis as any).BroadcastChannel || class { postMessage() {} close() {} addEventListener() {} onmessage = null };
  return store;
}

export async function freshServices() {
  vi.resetModules();
  const store = stubBrowser();
  const rds = (await import('../../src/services/restaurantDataService')).restaurantDataService;
  const ds = (await import('../../src/services/dataService')).dataService;
  return { store, rds: rds as any, ds: ds as any };
}

export const item = (n: string, price: number, qty = 1, extra: any = {}) => ({
  id: 'i-' + n + Math.random().toString(36).slice(2, 5), productId: n, productName: n, price, quantity: qty, status: 'SENT_TO_KITCHEN', ...extra,
});
