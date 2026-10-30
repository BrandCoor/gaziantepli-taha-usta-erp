import { describe, it, expect, beforeEach, vi } from 'vitest';

// restaurantDataService tarayıcı ortamı varsayar; izole sahte localStorage/window ile yüklenir.
function stubBrowser() {
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

describe('masa taşıma / birleştirme', () => {
  let svc: any;
  beforeEach(async () => {
    vi.resetModules();
    stubBrowser();
    const mod = await import('../src/services/restaurantDataService');
    svc = mod.restaurantDataService;
    svc.addSection({ name: 'Test Salon', tableCount: 12, capacityPerTable: 4 });
  });

  const item = (n: string, price: number, qty = 1) => ({ id: 'i-' + n, productId: n, productName: n, price, quantity: qty, status: 'SENT_TO_KITCHEN' });

  it('boş masaya taşır, kaynak boşalır', () => {
    const t = svc.getTables();
    const [a, b] = [t[0].id, t[1].id];
    svc.updateTableOrder(a, [item('çorba', 50, 2)]);
    expect(svc.transferTable(a, b)).toBe(true);
    const after = svc.getTables();
    expect(after.find((x: any) => x.id === a).order).toBeUndefined();
    expect(after.find((x: any) => x.id === b).order.items).toHaveLength(1);
    expect(after.find((x: any) => x.id === b).status).toBe('OCCUPIED');
  });

  it('dolu masaya taşıyınca ESEZMEZ, birleştirir; toplam doğru', () => {
    const t = svc.getTables();
    const [a, b] = [t[0].id, t[1].id];
    svc.updateTableOrder(a, [item('kebap', 200, 1)]);
    svc.updateTableOrder(b, [item('ayran', 20, 3)]);
    expect(svc.transferTable(a, b)).toBe(true);
    const tb = svc.getTables().find((x: any) => x.id === b);
    expect(tb.order.items.map((i: any) => i.productName).sort()).toEqual(['ayran', 'kebap']);
    expect(tb.order.totalAmount).toBe(260);
    expect(svc.getTables().find((x: any) => x.id === a).status).toBe('EMPTY');
  });

  it('aynı masaya veya olmayan masaya taşıma reddedilir, veri değişmez', () => {
    const t = svc.getTables();
    svc.updateTableOrder(t[0].id, [item('x', 10)]);
    expect(svc.transferTable(t[0].id, t[0].id)).toBe(false);
    expect(svc.transferTable(t[0].id, 'yok')).toBe(false);
    expect(svc.getTables().find((x: any) => x.id === t[0].id).order.items).toHaveLength(1);
  });

  it('boş kaynaktan taşıma reddedilir', () => {
    const t = svc.getTables();
    expect(svc.transferTable(t[2].id, t[3].id)).toBe(false);
  });
});
