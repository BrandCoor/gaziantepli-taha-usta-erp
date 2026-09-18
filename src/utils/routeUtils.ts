/**
 * Router ve URL parametre cozumleyici.
 *
 * Garson girisi artik YALNIZCA PIN ile yapilir; QR eslestirme rotasi
 * (/pair, /#/pair?token=...) kaldirilmistir. Daha once basilmis QR
 * etiketleri/linkleri olu sayfaya dusmesin diye bu adresler garson PIN
 * giris ekranina yonlendirilir.
 */

export interface AppRouteState {
  isWaiterMode: boolean;
  params: Record<string, string>;
  pathname: string;
  hashRoute: string;
}

export function parseAppRoute(): AppRouteState {
  if (typeof window === 'undefined') {
    return {
      isWaiterMode: false,
      params: {},
      pathname: '/',
      hashRoute: ''
    };
  }

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const search = window.location.search || '';
  const rawHash = window.location.hash || '';

  const params: Record<string, string> = {};

  // 1. Standart Query parametrelerini ayrıştır (?token=...&userId=...)
  if (search) {
    try {
      const searchParams = new URLSearchParams(search);
      searchParams.forEach((val, key) => {
        params[key] = val;
      });
    } catch (e) {
      console.warn('URLSearchParams ayrıştırma hatası:', e);
    }
  }

  // 2. Hash parametrelerini ayrıştır (/#/pair?token=... veya #pair?token=...)
  let hashRoute = '';
  if (rawHash) {
    // # veya #/ önekini temizle
    const cleanHash = rawHash.replace(/^#\/?/, '');
    const [hRoute, hQuery] = cleanHash.split('?');
    hashRoute = hRoute ? '/' + hRoute.replace(/^\/+|\/+$/g, '') : '';

    if (hQuery) {
      try {
        const hashParams = new URLSearchParams(hQuery);
        hashParams.forEach((val, key) => {
          // Eğer search'te yoksa veya boşsa hash parametresini al
          if (!params[key]) {
            params[key] = val;
          }
        });
      } catch (e) {
        console.warn('Hash parametre ayrıştırma hatası:', e);
      }
    }
  }

  // 3. Eski QR eslestirme adresleri (artik PIN ekranina yonlendirilir)
  const isLegacyPairRoute =
    pathname === '/pair' ||
    pathname.startsWith('/pair/') ||
    hashRoute === '/pair' ||
    hashRoute.startsWith('/pair/') ||
    params['page'] === 'pair' ||
    params['route'] === 'pair' ||
    params['mode'] === 'pair';

  // 4. Garson Modu Tespiti
  const isGarsonSubdomain = window.location.hostname.startsWith('garson.');
  const isWaiterQuery =
    params['mode'] === 'waiter' ||
    params['role'] === 'waiter' ||
    hashRoute === '/waiter' ||
    hashRoute === '/garson';

  const isWaiterMode = isGarsonSubdomain || isWaiterQuery || isLegacyPairRoute;

  return {
    isWaiterMode,
    params,
    pathname,
    hashRoute
  };
}
