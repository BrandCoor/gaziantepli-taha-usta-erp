import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isHashed, validatePasswordPolicy } from '../src/utils/passwordHash';
import { readThrottle, lockRemainingMs, recordFailure, recordSuccess } from '../src/utils/loginThrottle';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe('parola özeti', () => {
  it('hash düz metni içermez, biçimi doğru, her seferinde farklı tuz', async () => {
    const a = await hashPassword('GizliParola9');
    const b = await hashPassword('GizliParola9');
    expect(isHashed(a)).toBe(true);
    expect(a).not.toContain('GizliParola9');
    expect(a).not.toBe(b);
    expect(a.startsWith('pbkdf2$')).toBe(true);
  });
  it('doğru parola geçer, yanlış parola geçmez', async () => {
    const h = await hashPassword('GizliParola9');
    expect((await verifyPassword('GizliParola9', h)).ok).toBe(true);
    expect((await verifyPassword('gizliparola9', h)).ok).toBe(false);
    expect((await verifyPassword('', h)).ok).toBe(false);
  });
  it('eski düz metin kayıt doğrulanır ve yükseltme istenir', async () => {
    const r = await verifyPassword('123', '123');
    expect(r.ok).toBe(true);
    expect(r.needsUpgrade).toBe(true);
    expect((await verifyPassword('124', '123')).ok).toBe(false);
  });
  it('bozuk/boş kayıtlarda çökmez ve reddeder', async () => {
    expect((await verifyPassword('x', undefined)).ok).toBe(false);
    expect((await verifyPassword('x', 'pbkdf2$bozuk')).ok).toBe(false);
    expect((await verifyPassword('x', 'pbkdf2$abc$$')).ok).toBe(false);
  });
  it('parola politikası zayıf parolaları reddeder', () => {
    for (const w of ['1', '123', '12345', '123456', 'password', 'aaaaaaaa', 'Admin']) expect(validatePasswordPolicy(w), w).not.toBeNull();
    expect(validatePasswordPolicy('Antep2026!')).toBeNull();
  });
});

describe('giriş deneme kilidi', () => {
  it('ilk 4 hata kilitlemez, 5. hata 30 sn kilitler', () => {
    const s = mem();
    for (let i = 0; i < 4; i++) recordFailure(s, 1000);
    expect(lockRemainingMs(s, 1000)).toBe(0);
    recordFailure(s, 1000);
    expect(lockRemainingMs(s, 1000)).toBe(30_000);
    expect(lockRemainingMs(s, 1000 + 31_000)).toBe(0);
  });
  it('kilit süresi katlanır ve tavan 15 dk', () => {
    const s = mem();
    let t = 0;
    for (let i = 0; i < 10; i++) recordFailure(s, t);
    expect(lockRemainingMs(s, t)).toBe(60_000);
    for (let i = 0; i < 40; i++) recordFailure(s, t);
    expect(lockRemainingMs(s, t)).toBe(15 * 60_000);
  });
  it('başarılı giriş sayacı sıfırlar', () => {
    const s = mem();
    for (let i = 0; i < 6; i++) recordFailure(s, 0);
    recordSuccess(s);
    expect(readThrottle(s)).toEqual({ failures: 0, lockedUntil: 0 });
  });
});
