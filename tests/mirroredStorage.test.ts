import { describe, it, expect } from 'vitest';
import { MirroredStorage, asStorageProxy } from '../src/services/durableStorage';

const make = (initial: Record<string, string> = {}) => {
  const log: string[] = [];
  const s = new MirroredStorage(initial, {
    onSet: (k, v) => log.push(`set:${k}=${v.length > 10 ? '#' + v.length : v}`),
    onRemove: (k) => log.push(`rm:${k}`),
    onClear: () => log.push('clear'),
  });
  return { s, proxy: asStorageProxy(s), log };
};

describe('MirroredStorage (localStorage yerine)', () => {
  it('Storage arayüzü: getItem/setItem/removeItem/clear/key/length', () => {
    const { proxy } = make({ a: '1' });
    expect(proxy.getItem('a')).toBe('1');
    expect(proxy.getItem('yok')).toBeNull();
    proxy.setItem('b', '2');
    expect(proxy.length).toBe(2);
    expect(proxy.key(0)).toBe('a');
    expect(proxy.key(5)).toBeNull();
    proxy.removeItem('a');
    expect(proxy.length).toBe(1);
    proxy.clear();
    expect(proxy.length).toBe(0);
  });

  it('her yazma/silme/temizleme SIRAYLA dışarıya (SQLite) bildirilir', () => {
    const { proxy, log } = make();
    proxy.setItem('x', '1');
    proxy.setItem('x', '2');
    proxy.removeItem('x');
    proxy.removeItem('olmayan');   // olmayan anahtar için bildirim yok
    proxy.clear();
    expect(log).toEqual(['set:x=1', 'set:x=2', 'rm:x', 'clear']);
  });

  it('değerler metne çevrilir (Storage davranışı)', () => {
    const { proxy } = make();
    proxy.setItem('n', 5 as any);
    expect(proxy.getItem('n')).toBe('5');
  });

  it('özellik erişimi, in, delete ve Object.keys çalışır', () => {
    const { proxy, log } = make({ k1: 'v1' });
    (proxy as any).k2 = 'v2';
    expect((proxy as any).k2).toBe('v2');
    expect('k2' in proxy).toBe(true);
    expect('yok' in proxy).toBe(false);
    expect(Object.keys(proxy).sort()).toEqual(['k1', 'k2']);
    delete (proxy as any).k1;
    expect(proxy.getItem('k1')).toBeNull();
    expect(log).toContain('set:k2=v2');
    expect(log).toContain('rm:k1');
  });

  it('KOTA YOK: 30 MB değer yazılabilir (Chromium ~5-10 MB sınırı yok)', () => {
    const { proxy } = make();
    const big = 'x'.repeat(30 * 1024 * 1024);
    expect(() => proxy.setItem('buyuk', big)).not.toThrow();
    expect(proxy.getItem('buyuk')!.length).toBe(30 * 1024 * 1024);
  });
});
