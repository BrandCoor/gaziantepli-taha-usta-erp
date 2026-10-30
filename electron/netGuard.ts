/** Yerel sunucu için ağ/kaynak doğrulama yardımcıları (saf fonksiyonlar, test edilebilir). */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** "localhost:4545" gibi Host başlığı yalnızca yerel adres ise true. */
export function isAllowedHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.startsWith('[') ? hostHeader.slice(0, hostHeader.indexOf(']') + 1) : hostHeader.split(':')[0];
  return LOCAL_HOSTS.has(host.toLowerCase());
}

/**
 * Origin başlığı: yok (sunucudan sunucuya/araç), "null" (file:// ile açılan Electron penceresi)
 * veya geliştirme sunucusu (localhost:3000) ise izinli.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === 'null' || origin === 'file://') return true;
  try {
    const u = new URL(origin);
    return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && (u.port === '3000' || u.port === '4545');
  } catch {
    return false;
  }
}

/** Özel (RFC1918), link-local ve loopback IPv4 adresleri. */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return false;
  const [a, b] = o;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}
