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

import { APP_VERSION } from './appVersion';

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
        // Sürüm uyumluluğu: sunucu çok eski istemciyi 426 ile reddeder (sessiz veri kaybı olmasın).
        headers.set('X-Client-Type', 'kasa');
        headers.set('X-Client-Version', APP_VERSION);
        return original(input, { ...init, headers }).then(async (res) => {
          if (res.status === 426) {
            let msg = 'Bu kasa sürümü sunucu tarafından desteklenmiyor. Uygulamayı güncelleyin.';
            try { const j = await res.clone().json(); if (j?.error) msg = j.error; } catch {}
            window.dispatchEvent(new CustomEvent('gtu-client-outdated', { detail: { message: msg } }));
          }
          return res;
        });
      }
    } catch {}
    return original(input, init);
  };
}

const QR_URL_STORAGE = 'CUSTOM_QR_MENU_URL';
/** QR menü sayfasının adresi (ör. https://qr.ornek.com). Alt alan adı kullanılıyorsa API'den ayrı olduğu için elle girilir. */
export const getQrMenuUrl = (): string => {
  try { return (localStorage.getItem(QR_URL_STORAGE) || '').trim().replace(/\/+$/, ''); } catch { return ''; }
};
export const setQrMenuUrl = (url: string): void => {
  try {
    const u = (url || '').trim();
    if (u) localStorage.setItem(QR_URL_STORAGE, u); else localStorage.removeItem(QR_URL_STORAGE);
  } catch {}
};
