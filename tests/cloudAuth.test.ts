import { describe, it, expect } from 'vitest';
import { isConfiguredApiUrl } from '../src/services/cloudAuth';

describe('isConfiguredApiUrl', () => {
  const base = 'https://api.ornek-restoran.com/api/index.php';
  it('aynı origin için true', () => {
    expect(isConfiguredApiUrl('https://api.ornek-restoran.com/api/index.php?action=x', base)).toBe(true);
  });
  it('farklı alan adı için false (anahtar sızmaz)', () => {
    expect(isConfiguredApiUrl('https://evil.example.com/api/index.php', base)).toBe(false);
    expect(isConfiguredApiUrl('https://api.ornek-restoran.com.evil.com/x', base)).toBe(false);
  });
  it('farklı port/şema için false', () => {
    expect(isConfiguredApiUrl('http://api.ornek-restoran.com/api/index.php', base)).toBe(false);
  });
  it('boş/bozuk değerlerde false', () => {
    expect(isConfiguredApiUrl('', base)).toBe(false);
    expect(isConfiguredApiUrl('https://a.com', '')).toBe(false);
    expect(isConfiguredApiUrl('https://a.com', 'bozuk')).toBe(false);
  });
});
