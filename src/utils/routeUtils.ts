/**
 * Router ve URL parametre çözümleyici
 * Hem HTML5 History API (/pair) hem de HashRouter (/#/pair) rotalarını,
 * query parametrelerini (?token=...&userId=...) ve karma hash URL'lerini
 * sunucu konfigürasyonundan bağımsız olarak güvenle ayrıştırır.
 */

export interface AppRouteState {
  isPairRoute: boolean;
  isWaiterMode: boolean;
  token: string;
  userId: string;
  params: Record<string, string>;
  pathname: string;
  hashRoute: string;
}

export function parseAppRoute(): AppRouteState {
  if (typeof window === 'undefined') {
    return {
      isPairRoute: false,
      isWaiterMode: false,
      token: '',
      userId: '',
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

  // 3. Eşleştirme (Pairing) Ekranı Tespiti
  const isPairPath = pathname === '/pair' || pathname.startsWith('/pair/');
  const isPairHash = hashRoute === '/pair' || hashRoute === 'pair' || hashRoute.startsWith('/pair/');
  const isPairParam = params['page'] === 'pair' || params['route'] === 'pair' || params['mode'] === 'pair';
  const hasPairTokens = Boolean(params['token']) && (Boolean(params['userId']) || Boolean(params['id']));

  const isPairRoute = isPairPath || isPairHash || isPairParam || hasPairTokens;

  // 4. Garson Modu Tespiti
  const isGarsonSubdomain = window.location.hostname.startsWith('garson.');
  const isWaiterQuery = 
    params['mode'] === 'waiter' || 
    params['role'] === 'waiter' || 
    hashRoute === '/waiter' || 
    hashRoute === 'waiter';

  const isWaiterMode = isGarsonSubdomain || isWaiterQuery || isPairRoute;

  const token = params['token'] || '';
  const userId = params['userId'] || params['id'] || '';

  return {
    isPairRoute,
    isWaiterMode,
    token,
    userId,
    params,
    pathname,
    hashRoute
  };
}
