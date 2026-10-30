import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  compareVersions, parseVersion, normalizeFeedUrl, resolveFeedUrl, parsePolicy, classify, decideInstall, deadlinePassed, backoffMs,
  UpdateController, UpdaterLike, UpdateStatus,
} from '../electron/updateLogic';

/** electron-updater yerine geçen sahte; olayları testten tetikleriz. */
class FakeUpdater extends EventEmitter implements UpdaterLike {
  check = vi.fn(async () => undefined);
  download = vi.fn(async () => undefined);
  installed = vi.fn();
  checkForUpdates() { return this.check(); }
  downloadUpdate() { return this.download(); }
  quitAndInstall(a?: boolean, b?: boolean) { this.installed(a, b); }
}
const mk = (over: Partial<ConstructorParameters<typeof UpdateController>[0]> = {}, current = '1.0.0') => {
  const updater = new FakeUpdater();
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const log: string[] = [];
  const c = new UpdateController({
    updater, current, log: (l, m) => log.push(`${l}:${m}`),
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => {},
    ...over,
  });
  return { updater, c, timers, log };
};
const states = (c: UpdateController) => { const a: UpdateStatus['state'][] = []; c.onStatus((s) => a.push(s.state)); return a; };

describe('sürüm karşılaştırma ve kaynak', () => {
  it('sürümleri doğru sıralar', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('v2.0.0', '2.0.0')).toBe(0);
    expect(compareVersions('abc', '1.0.0')).toBeNull();
    expect(parseVersion('1.2.3-beta.1')).toEqual([1, 2, 3]);
  });
  it('güncelleme adresi: yalnızca HTTPS (yerel test hariç), parola yok, sonuna / eklenir', () => {
    expect(normalizeFeedUrl('https://api.ornek.com/updates')).toBe('https://api.ornek.com/updates/');
    expect(normalizeFeedUrl('http://ornek.com/updates/')).toBeNull();
    expect(normalizeFeedUrl('http://127.0.0.1:8095/x')).toBe('http://127.0.0.1:8095/x/');
    expect(normalizeFeedUrl('https://user:pw@ornek.com/')).toBeNull();
    expect(normalizeFeedUrl('ftp://ornek.com/')).toBeNull();
    expect(normalizeFeedUrl('')).toBeNull();
  });
  it('kaynak önceliği: ayar > ortam > paket > API', () => {
    const base = { userConfigured: 'https://a.com/u', env: 'https://b.com/u', packaged: 'https://c.com/u', apiBase: 'https://api.d.com/index.php' };
    expect(resolveFeedUrl(base)).toEqual({ url: 'https://a.com/u/', source: 'ayar' });
    expect(resolveFeedUrl({ ...base, userConfigured: null })).toEqual({ url: 'https://b.com/u/', source: 'ortam' });
    expect(resolveFeedUrl({ apiBase: 'https://api.d.com/index.php' })).toEqual({ url: 'https://api.d.com/updates/', source: 'api' });
    expect(resolveFeedUrl({ userConfigured: 'http://kotu.com' })).toEqual({ url: null, source: 'yok' });
    expect(resolveFeedUrl({})).toEqual({ url: null, source: 'yok' });
  });
  it('politika dosyası doğrulanır; bozuksa reddedilir', () => {
    expect(parsePolicy('{"latest":"1.2.0","critical":true,"minSupported":"1.1.0","deadline":"2026-12-01","notes":"x"}')).toMatchObject({ critical: true, minSupported: '1.1.0' });
    expect(parsePolicy('{"latest":"abc"}')).toBeNull();
    expect(parsePolicy('{"deadline":"yarın"}')).toBeNull();
    expect(parsePolicy('<html>')).toBeNull();
    expect(parsePolicy([])).toBeNull();
  });
  it('sınıflandırma: normal / kritik / desteklenmeyen sürüm', () => {
    expect(classify('1.0.0', '1.1.0', null)).toBe('normal');
    expect(classify('1.0.0', '1.1.0', { critical: true })).toBe('critical');
    expect(classify('1.0.0', '1.1.0', { minSupported: '1.0.5' })).toBe('critical');
    expect(classify('1.1.0', '1.1.0', null)).toBe('none');
    expect(classify('1.0.0', null, { minSupported: '1.0.5' })).toBe('critical');
  });
});

describe('kurulum zamanı kararı (veri güvenliği)', () => {
  it('açık adisyon veya ödeme sürerken ASLA kurulmaz', () => {
    expect(decideInstall({ openOrders: 2, paymentInProgress: false }).allowed).toBe(false);
    expect(decideInstall({ openOrders: 0, paymentInProgress: true }).allowed).toBe(false);
    expect(decideInstall({ openOrders: 0, paymentInProgress: false }).allowed).toBe(true);
  });
  it('kritik güncelleme son tarihi', () => {
    expect(deadlinePassed({ deadline: '2026-01-01' }, new Date('2026-02-01'))).toBe(true);
    expect(deadlinePassed({ deadline: '2026-03-01' }, new Date('2026-02-01'))).toBe(false);
    expect(deadlinePassed(null)).toBe(false);
  });
  it('tekrar deneme aralığı artar ve sınırlıdır', () => {
    expect(backoffMs(0)).toBeLessThan(backoffMs(1));
    expect(backoffMs(99)).toBe(backoffMs(4));
  });
});

describe('güncelleme denetleyicisi — senaryolar', () => {
  it('1) yeni sürüm yok: normal çalışır, hata yok', async () => {
    const { updater, c } = mk();
    updater.check.mockImplementation(async () => { updater.emit('update-not-available', {}); });
    const st = await c.check();
    expect(st.state).toBe('up-to-date');
    expect(updater.download).not.toHaveBeenCalled();
  });

  it('2) yeni sürüm bulunur → indirilir → doğrulanmış paket hazır', async () => {
    const snap = vi.fn(() => ({ ok: true }));
    const { updater, c } = mk({ snapshot: snap, fetchPolicy: async () => ({ notes: 'Yeni özellikler', latest: '1.1.0' }) });
    const seen = states(c);
    updater.check.mockImplementation(async () => { updater.emit('update-available', { version: '1.1.0' }); });
    updater.download.mockImplementation(async () => { updater.emit('download-progress', { percent: 40 }); updater.emit('update-downloaded', { version: '1.1.0' }); });
    await c.check();
    await Promise.resolve();
    expect(seen).toContain('downloading');
    expect(c.getStatus()).toMatchObject({ state: 'downloaded', available: '1.1.0', kind: 'normal', notes: 'Yeni özellikler' });
    expect(updater.installed).not.toHaveBeenCalled(); // otomatik kurulum YOK
  });

  it('geri sürüm / aynı sürüm teklifi ASLA indirilmez (düşürme saldırısı)', async () => {
    const { updater, c } = mk({}, '1.2.0');
    updater.check.mockImplementation(async () => { updater.emit('update-available', { version: '1.0.0' }); });
    await c.check();
    expect(updater.download).not.toHaveBeenCalled();
    expect(c.getStatus().state).toBe('up-to-date');
  });

  it('3) indirme sırasında internet kesilir: kontrollü, artan aralıklarla yeniden dener', async () => {
    const { updater, c, timers } = mk();
    updater.check.mockImplementation(async () => { updater.emit('update-available', { version: '1.1.0' }); });
    updater.download.mockRejectedValue(new Error('net::ERR_INTERNET_DISCONNECTED'));
    await c.check();
    await Promise.resolve(); await Promise.resolve();
    expect(c.getStatus().state).toBe('error');
    expect(c.getStatus().message).toMatch(/yeniden denenecek/);
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(backoffMs(0));
    // süre dolunca yeniden dener; bağlantı gelmiş
    updater.download.mockImplementation(async () => { updater.emit('update-downloaded', { version: '1.1.0' }); });
    timers[0].fn();
    await new Promise((r) => setTimeout(r, 0));
    expect(c.getStatus().state).toBe('downloaded');
  });

  it('3b) sürekli hata: en fazla N denemeden sonra durur (sonsuz döngü yok)', async () => {
    const { updater, c, timers } = mk({ maxAttempts: 3 });
    updater.check.mockRejectedValue(new Error('timeout'));
    await c.check();
    let fired = 0;
    while (timers[fired] && fired < 20) { timers[fired].fn(); fired++; await new Promise((r) => setTimeout(r, 0)); }
    expect(updater.check).toHaveBeenCalledTimes(3);
    expect(c.getStatus().state).toBe('error');
    expect(timers).toHaveLength(2); // 3. denemeden sonra yeni zamanlayıcı kurulmaz
  });

  it('4) bozuk / doğrulanamayan paket REDDEDİLİR: tekrar denenmez, kurulum yapılamaz', async () => {
    const { updater, c, timers, log } = mk();
    updater.check.mockImplementation(async () => { updater.emit('update-available', { version: '1.1.0' }); });
    updater.download.mockRejectedValue(new Error('sha512 checksum mismatch, expected abc, got def'));
    await c.check();
    await Promise.resolve(); await Promise.resolve();
    expect(c.getStatus().state).toBe('rejected');
    expect(timers).toHaveLength(0);
    expect(log.some((l) => l.startsWith('error:') && /reddedildi/.test(l))).toBe(true);
    expect(c.install({ openOrders: 0, paymentInProgress: false }).ok).toBe(false);
    expect(updater.installed).not.toHaveBeenCalled();
  });

  it('5/12) kurulum: açık adisyon varken reddedilir; yedek alınamazsa reddedilir; güvenliyse yeniden başlatır', async () => {
    let snapOk = true;
    const { updater, c } = mk({ snapshot: () => ({ ok: snapOk, message: 'disk dolu' }) });
    updater.check.mockImplementation(async () => { updater.emit('update-available', { version: '1.1.0' }); });
    updater.download.mockImplementation(async () => { updater.emit('update-downloaded', { version: '1.1.0' }); });
    await c.check(); await Promise.resolve();
    expect(c.install({ openOrders: 3, paymentInProgress: false })).toMatchObject({ ok: false });
    expect(c.install({ openOrders: 0, paymentInProgress: true })).toMatchObject({ ok: false });
    snapOk = false;
    expect(c.install({ openOrders: 0, paymentInProgress: false })).toMatchObject({ ok: false, message: expect.stringMatching(/yedeği alınamadığı/) });
    expect(updater.installed).not.toHaveBeenCalled();
    snapOk = true;
    expect(c.install({ openOrders: 0, paymentInProgress: false }).ok).toBe(true);
    expect(updater.installed).toHaveBeenCalledTimes(1);
    expect(updater.installed).toHaveBeenCalledWith(true, true); // sessiz kurulum + otomatik yeniden aç
  });

  it('indirilmemiş güncelleme kurulamaz', () => {
    const { updater, c } = mk();
    expect(c.install({ openOrders: 0, paymentInProgress: false }).ok).toBe(false);
    expect(updater.installed).not.toHaveBeenCalled();
  });

  it('kritik güncelleme işaretlenir ve kullanıcıya bildirilir ama zorla kurulmaz', async () => {
    const { updater, c } = mk({ fetchPolicy: async () => ({ critical: true, deadline: '2026-12-01', notes: 'Güvenlik açığı' }) });
    updater.check.mockImplementation(async () => { updater.emit('update-available', { version: '1.0.1' }); });
    updater.download.mockImplementation(async () => { updater.emit('update-downloaded', { version: '1.0.1' }); });
    await c.check(); await Promise.resolve();
    expect(c.getStatus()).toMatchObject({ state: 'downloaded', kind: 'critical', critical: true, deadline: '2026-12-01' });
    expect(c.install({ openOrders: 1, paymentInProgress: false }).ok).toBe(false); // açık adisyon varken kritik bile kurulmaz
    expect(updater.installed).not.toHaveBeenCalled();
  });

  it('desteklenmeyen sürüm (minSupported) güncelleme yokken de uyarılır', async () => {
    const { updater, c } = mk({ fetchPolicy: async () => ({ minSupported: '1.0.5' }) });
    updater.check.mockImplementation(async () => { updater.emit('update-not-available', {}); });
    await c.check();
    expect(c.getStatus()).toMatchObject({ state: 'up-to-date', kind: 'critical', critical: true });
  });

  it('kapalı (yapılandırılmamış) iken denetim yapmaz', async () => {
    const { updater, c } = mk();
    c.disable('kaynak yok');
    await c.check();
    expect(updater.check).not.toHaveBeenCalled();
    c.enable();
    expect(c.getStatus().state).toBe('idle');
  });

  it('çakışan denetimler tek isteğe indirgenir', async () => {
    const { updater, c } = mk();
    let release!: () => void;
    updater.check.mockImplementation(() => new Promise<void>((r) => { release = () => { updater.emit('update-not-available', {}); r(); }; }));
    const a = c.check(); const b = c.check();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    release(); await Promise.all([a, b]);
    expect(updater.check).toHaveBeenCalledTimes(1);
  });
});
