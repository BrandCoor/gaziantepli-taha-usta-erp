/**
 * Kasa → bulut API kimlik doğrulaması.
 * Kasa anahtarı yalnızca AYARLANMIŞ sunucu adresine (aynı origin) giden isteklere eklenir;
 * üçüncü taraf adreslere (ör. platform API'leri, yazıcı) asla gönderilmez.
 */
const KEY_STORAGE = 'CUSTOM_KASA_API_KEY';
const URL_STORAGE = 'CUSTOM_API_SYNC_URL';

export const getKasaApiKey = (): string => {
  try { return (localStorage.getItem(KEY_STORAGE) || '').trim(); } catch { return ''; }
};

export const setKasaApiKey = (key: string): void => {
  try {
    const k = (key || '').trim();
    if (k) localStorage.setItem(KEY_STORAGE, k); else localStorage.removeItem(KEY_STORAGE);
  } catch {}
};

/** Verilen istek adresi, ayarlı bulut API'si ile aynı origin ise true. */
export function isConfiguredApiUrl(requestUrl: string, configuredUrl: string): boolean {
  if (!requestUrl || !configuredUrl) return false;
  try {
    const a = new URL(requestUrl, 'http://invalid.local');
    const b = new URL(configuredUrl);
    return a.origin === b.origin;
  } catch {
    return false;
  }
}

let installed = false;

export function installCloudAuth(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const key = getKasaApiKey();
      const base = (localStorage.getItem(URL_STORAGE) || '').trim();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (key && base && isConfiguredApiUrl(url, base)) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has('X-Kasa-Key')) headers.set('X-Kasa-Key', key);
        return original(input, { ...init, headers });
      }
    } catch {}
    return original(input, init);
  };
}
