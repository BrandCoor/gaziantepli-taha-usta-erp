/**
 * Giriş deneme kilidi. 5 hatalı denemeden sonra 30 sn, sonraki her 5 hatada süre ikiye katlanır (en çok 15 dk).
 * Başarılı girişte sayaç sıfırlanır. Saklama yerel (localStorage); saldırgan uygulamanın kendisine erişemiyorsa
 * zaten bu kilide ihtiyaç yoktur — amaç kasada yanında duran biri tarafından parola denemesini yavaşlatmaktır.
 */
export interface ThrottleState {
  failures: number;
  lockedUntil: number;
}

const KEY = 'gtu_login_throttle';
const FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function readThrottle(store: Store): ThrottleState {
  try {
    const v = JSON.parse(store.getItem(KEY) || '{}');
    return { failures: Number(v.failures) || 0, lockedUntil: Number(v.lockedUntil) || 0 };
  } catch {
    return { failures: 0, lockedUntil: 0 };
  }
}

/** Kilitliyse kalan milisaniye, değilse 0. */
export function lockRemainingMs(store: Store, now = Date.now()): number {
  return Math.max(0, readThrottle(store).lockedUntil - now);
}

export function recordFailure(store: Store, now = Date.now()): ThrottleState {
  const s = readThrottle(store);
  s.failures += 1;
  if (s.failures >= FREE_ATTEMPTS && s.failures % FREE_ATTEMPTS === 0) {
    const level = s.failures / FREE_ATTEMPTS - 1;
    s.lockedUntil = now + Math.min(BASE_LOCK_MS * 2 ** level, MAX_LOCK_MS);
  }
  store.setItem(KEY, JSON.stringify(s));
  return s;
}

export function recordSuccess(store: Store): void {
  store.removeItem(KEY);
}
