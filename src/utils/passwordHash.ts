/**
 * Parola özeti (PBKDF2-SHA256, WebCrypto). Saklanan biçim: `pbkdf2$<iterasyon>$<tuz b64>$<özet b64>`.
 * Eski kurulumlardaki düz metin parolalar `verifyPassword` ile doğrulanır ve çağıran tarafça hash'e yükseltilir.
 */
const PREFIX = 'pbkdf2';
const ITERATIONS = 150_000;

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const fromB64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
}

export const isHashed = (stored: string | undefined | null): boolean => !!stored && stored.startsWith(PREFIX + '$');

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${toB64(salt)}$${toB64(bits)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string | undefined | null): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (!stored) return { ok: false, needsUpgrade: false };
  if (!isHashed(stored)) {
    // Eski düz metin kayıt: sabit zamanlı karşılaştırma, başarılıysa yükseltilmeli
    const enc = new TextEncoder();
    return { ok: timingSafeEqual(enc.encode(password), enc.encode(stored)), needsUpgrade: true };
  }
  const [, iterStr, saltB64, hashB64] = stored.split('$');
  const iterations = parseInt(iterStr, 10);
  if (!iterations || !saltB64 || !hashB64) return { ok: false, needsUpgrade: false };
  const bits = await derive(password, fromB64(saltB64), iterations);
  return { ok: timingSafeEqual(new Uint8Array(bits), fromB64(hashB64)), needsUpgrade: iterations < ITERATIONS };
}

/** Parola politikası (ilk kurulum ve parola değişikliği). Mesaj döner; geçerliyse null. */
export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 6) return 'Parola en az 6 karakter olmalıdır.';
  if (/^(.)\1+$/.test(password)) return 'Parola tek karakterin tekrarı olamaz.';
  const weak = new Set(['123456', '1234567', '12345678', 'password', 'parola', 'admin', 'admin123', '111111', 'qwerty', 'tahausta']);
  if (weak.has(password.toLowerCase())) return 'Bu parola çok kolay tahmin edilir. Başka bir parola seçin.';
  return null;
}
