import { describe, it, expect } from 'vitest';
import { ProcessedIdStore, normalizeIncomingId } from '../src/services/incomingOrderDedup';

const memStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('normalizeIncomingId', () => {
  it('clientOrderId varsa sunucuyla aynı ord-<id> biçimini üretir', () => {
    expect(normalizeIncomingId({ clientOrderId: 'abcdef1234567890' })).toBe('ord-abcdef1234567890');
  });
  it('kısa/geçersiz clientOrderId yok sayılır, id kullanılır', () => {
    expect(normalizeIncomingId({ clientOrderId: 'abc', id: 'ord-1' })).toBe('ord-1');
  });
  it('özel karakterleri temizler', () => {
    expect(normalizeIncomingId({ clientOrderId: 'abcd!!efgh1234' })).toBe('ord-abcdefgh1234');
  });
});

describe('ProcessedIdStore', () => {
  it('uygulama yeniden başlayınca (yeni nesne) işlenmiş kimlikleri hatırlar', () => {
    const st = memStorage();
    const a = new ProcessedIdStore(st);
    a.add('ord-1');
    const b = new ProcessedIdStore(st);
    expect(b.has('ord-1')).toBe(true);
    expect(b.has('ord-2')).toBe(false);
  });
  it('sınırı aşınca en eskiyi atar', () => {
    const s = new ProcessedIdStore(memStorage(), 'k', 3);
    ['a', 'b', 'c', 'd'].forEach((i) => s.add(i));
    expect(s.has('a')).toBe(false);
    expect(s.has('d')).toBe(true);
  });
  it('bozuk saklama verisinde çökmez', () => {
    const st = memStorage();
    st.setItem('gtu_processed_incoming_ids', '{bozuk');
    expect(() => new ProcessedIdStore(st)).not.toThrow();
  });
});
