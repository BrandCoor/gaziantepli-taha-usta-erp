import { describe, it, expect } from 'vitest';
import { isAllowedHost, isAllowedOrigin, isPrivateOrLoopbackIp } from '../electron/netGuard';

describe('netGuard', () => {
  it('Host: yalnızca yerel adresler', () => {
    expect(isAllowedHost('localhost:4545')).toBe(true);
    expect(isAllowedHost('127.0.0.1:4545')).toBe(true);
    expect(isAllowedHost('[::1]:4545')).toBe(true);
    expect(isAllowedHost('evil.com')).toBe(false);
    expect(isAllowedHost('192.168.1.5:4545')).toBe(false);
    expect(isAllowedHost('localhost.evil.com')).toBe(false);
    expect(isAllowedHost(undefined)).toBe(false);
  });
  it('Origin: uygulama penceresi ve geliştirme sunucusu', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin('null')).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    expect(isAllowedOrigin('http://localhost:9999')).toBe(false);
    expect(isAllowedOrigin('http://localhost.evil.com:3000')).toBe(false);
  });
  it('yazıcı IP: yalnızca özel ağ', () => {
    for (const ok of ['192.168.1.50', '10.0.0.7', '172.16.5.5', '172.31.255.1', '127.0.0.1']) expect(isPrivateOrLoopbackIp(ok), ok).toBe(true);
    for (const bad of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '1.2.3.4', 'evil.com', '192.168.1.999', '', '192.168.1']) expect(isPrivateOrLoopbackIp(bad), bad).toBe(false);
  });
});
