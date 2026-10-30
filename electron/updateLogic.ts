/**
 * Güncelleme mantığı (saf TypeScript; Electron'a bağımlı değil → izole test edilebilir).
 *
 * Bu dosya KARAR verir; indirme/imza/özet doğrulaması electron-updater'dadır (latest.yml içindeki SHA-512).
 */

// ───────────────────────── sürüm karşılaştırma ─────────────────────────
export function parseVersion(v: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(v || '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
/** a<b → -1, a=b → 0, a>b → 1. Geçersiz sürüm → null. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

// ───────────────────────── güncelleme kaynağı (merkezi yapılandırma) ─────────────────────────
export interface FeedSources {
  /** Kullanıcının ayarlardan girdiği adres (en yüksek öncelik). */
  userConfigured?: string | null;
  /** Ortam değişkeni (GTU_UPDATE_URL). */
  env?: string | null;
  /** Kurulum paketine gömülü update-config.json içindeki adres. */
  packaged?: string | null;
  /** Kullanıcının kendi API adresinden türetilen varsayılan (<api>/updates/). */
  apiBase?: string | null;
}
/** Yalnızca HTTPS (yerel ağ/localhost testi hariç). Sonuna / eklenir. Geçersizse null. */
export function normalizeFeedUrl(raw: string | null | undefined): string | null {
  const t = String(raw || '').trim();
  if (!t) return null;
  let u: URL;
  try { u = new URL(t); } catch { return null; }
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null;
  if (u.username || u.password) return null; // adreste parola taşınmaz
  return u.href.replace(/[?#].*$/, '').replace(/\/?$/, '/');
}
export function resolveFeedUrl(s: FeedSources): { url: string | null; source: string } {
  const order: Array<[string, string | null | undefined, boolean]> = [
    ['ayar', s.userConfigured, false], ['ortam', s.env, false], ['paket', s.packaged, false], ['api', s.apiBase, true],
  ];
  for (const [source, raw, derive] of order) {
    const base = raw ? (derive ? String(raw).replace(/\/index\.php\/?$/, '').replace(/\/+$/, '') + '/updates' : raw) : null;
    const url = normalizeFeedUrl(base);
    if (url) return { url, source };
  }
  return { url: null, source: 'yok' };
}

// ───────────────────────── sürüm politikası (update-policy.json) ─────────────────────────
export interface UpdatePolicy {
  /** Yayınlanan en son sürüm (bilgi). */
  latest?: string;
  /** Bu sürümün ALTINDAKİLER güvenlik açısından desteklenmez (kritik güncelleme). */
  minSupported?: string;
  critical?: boolean;
  /** Kritik güncelleme için "en geç" tarih (YYYY-MM-DD). Bu tarihten sonra güvenli anda otomatik kurulur. */
  deadline?: string;
  notes?: string;
  /** Bu masaüstü sürümünün çalışabildiği en eski API sürümü. */
  minApi?: string;
}
export function parsePolicy(raw: unknown): UpdatePolicy | null {
  let o: any = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const out: UpdatePolicy = {};
  for (const k of ['latest', 'minSupported', 'minApi'] as const) {
    if (o[k] !== undefined) { if (!parseVersion(o[k])) return null; out[k] = String(o[k]); }
  }
  if (o.critical !== undefined) out.critical = o.critical === true;
  if (o.deadline !== undefined) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(o.deadline))) return null; out.deadline = String(o.deadline); }
  if (o.notes !== undefined) out.notes = String(o.notes).slice(0, 4000);
  return out;
}

export type UpdateKind = 'none' | 'normal' | 'critical';
/** Kurulu sürüm politikaya göre ne durumda? */
export function classify(current: string, available: string | null, policy: UpdatePolicy | null): UpdateKind {
  if (!available) return policy?.minSupported && compareVersions(current, policy.minSupported) === -1 ? 'critical' : 'none';
  if (compareVersions(current, available) !== -1) return 'none';
  const belowMin = policy?.minSupported && compareVersions(current, policy.minSupported) === -1;
  return policy?.critical || belowMin ? 'critical' : 'normal';
}

// ───────────────────────── kurulum zamanı kararı ─────────────────────────
export interface WorkState {
  /** İçinde açık adisyon bulunan masa sayısı. */
  openOrders: number;
  /** Devam eden ödeme/adisyon kapatma işlemi var mı. */
  paymentInProgress: boolean;
}
export interface InstallDecision { allowed: boolean; reason: string }
/**
 * Kurulum (yeniden başlatma) YALNIZCA hiç açık adisyon ve devam eden işlem yokken yapılır.
 * Kritik güncelleme bile açık adisyonu riske atarak zorla kurulmaz; bekletilir ve kullanıcı uyarılır.
 */
export function decideInstall(work: WorkState): InstallDecision {
  if (work.paymentInProgress) return { allowed: false, reason: 'Devam eden bir ödeme/adisyon kapatma işlemi var.' };
  if (work.openOrders > 0) return { allowed: false, reason: `${work.openOrders} masada açık adisyon var; önce adisyonları kapatın.` };
  return { allowed: true, reason: 'Güvenli an: açık adisyon yok.' };
}
/** Kritik güncelleme için son tarih geçti mi? (geçtiyse güvenli anda ARTIK otomatik kurulur; yine de açık adisyon varken değil.) */
export function deadlinePassed(policy: UpdatePolicy | null, now: Date = new Date()): boolean {
  if (!policy?.deadline) return false;
  return now.getTime() > new Date(policy.deadline + 'T23:59:59').getTime();
}

// ───────────────────────── tekrar deneme ─────────────────────────
const BACKOFF_MS = [30_000, 120_000, 600_000, 1_800_000, 3_600_000];
export function backoffMs(attempt: number): number { return BACKOFF_MS[Math.min(Math.max(attempt, 0), BACKOFF_MS.length - 1)]; }

// ───────────────────────── denetleyici ─────────────────────────
export type UpdateState = 'disabled' | 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error' | 'rejected';
export interface UpdateStatus {
  state: UpdateState;
  current: string;
  available?: string;
  kind: UpdateKind;
  progress?: number; // 0-100
  message?: string;
  notes?: string;
  critical?: boolean;
  deadline?: string;
  retryAt?: number;
  attempts?: number;
  feedSource?: string;
  lastCheckAt?: number;
}
/** electron-updater'ın kullandığımız yüzeyi (testte sahtesi yazılır). */
export interface UpdaterLike {
  on(event: string, cb: (...a: any[]) => void): any;
  checkForUpdates(): Promise<any>;
  downloadUpdate(): Promise<any>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}
export interface ControllerDeps {
  updater: UpdaterLike;
  current: string;
  fetchPolicy?: () => Promise<UpdatePolicy | null>;
  snapshot?: () => { ok: boolean; message?: string }; // kurulumdan önce veri anlık görüntüsü
  log?: (level: 'info' | 'warn' | 'error', msg: string) => void;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (t: any) => void;
  now?: () => number;
  maxAttempts?: number;
}

const CHECKSUM_ERR = /sha512|checksum|signature|imza|publisher|ERR_UPDATER_(CHECKSUM|INVALID|SIGN)/i;

export class UpdateController {
  private status: UpdateStatus;
  private listeners = new Set<(s: UpdateStatus) => void>();
  private policy: UpdatePolicy | null = null;
  private attempts = 0;
  private timer: any = null;
  private busy = false;
  private downloadedVersion: string | null = null;
  private readonly setTimer: (fn: () => void, ms: number) => any;
  private readonly clearTimer: (t: any) => void;

  constructor(private d: ControllerDeps) {
    this.setTimer = d.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = d.clearTimer ?? ((t) => clearTimeout(t));
    this.status = { state: 'idle', current: d.current, kind: 'none' };
    const u = d.updater;
    u.on('update-available', (info: any) => this.onAvailable(info));
    u.on('update-not-available', () => this.onNone());
    u.on('download-progress', (p: any) => this.set({ state: 'downloading', progress: Math.round(Number(p?.percent) || 0) }));
    u.on('update-downloaded', (info: any) => this.onDownloaded(info));
    u.on('error', (e: any) => this.onError(e));
  }

  getStatus(): UpdateStatus { return { ...this.status }; }
  onStatus(cb: (s: UpdateStatus) => void): () => void { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  private log(l: 'info' | 'warn' | 'error', m: string) { try { this.d.log?.(l, m); } catch {} }
  private set(p: Partial<UpdateStatus>) {
    this.status = { ...this.status, ...p };
    for (const cb of this.listeners) { try { cb(this.getStatus()); } catch {} }
  }
  disable(message: string, feedSource?: string) { this.set({ state: 'disabled', message, feedSource }); }
  enable(feedSource?: string) { if (this.status.state === 'disabled') this.set({ state: 'idle', message: undefined, feedSource }); }

  async check(): Promise<UpdateStatus> {
    if (this.status.state === 'disabled' || this.busy) return this.getStatus();
    if (this.status.state === 'downloading' || this.status.state === 'downloaded') return this.getStatus();
    this.busy = true;
    this.set({ state: 'checking', message: undefined });
    try {
      this.policy = (await this.d.fetchPolicy?.().catch(() => null)) ?? null;
      this.set({ lastCheckAt: (this.d.now ?? Date.now)() });
      await this.d.updater.checkForUpdates(); // sonuç olaylarla gelir
    } catch (e) {
      this.onError(e);
    } finally {
      this.busy = false;
    }
    return this.getStatus();
  }

  private onNone() {
    this.attempts = 0;
    const kind = classify(this.d.current, null, this.policy);
    this.set({
      state: 'up-to-date', kind, available: undefined, progress: undefined,
      message: kind === 'critical' ? 'Kurulu sürüm artık desteklenmiyor; yeni sürüm yayımlandığında hemen kurulmalıdır.' : undefined,
      critical: kind === 'critical',
    });
    this.log('info', 'Güncelleme yok');
  }

  private onAvailable(info: any) {
    const v = String(info?.version || '');
    // Geri sürüm / aynı sürüm ASLA yüklenmez (düşürme saldırısına karşı).
    if (compareVersions(this.d.current, v) !== -1) {
      this.log('warn', `Geçersiz güncelleme yok sayıldı: kurulu ${this.d.current}, teklif ${v}`);
      return this.onNone();
    }
    const kind = classify(this.d.current, v, this.policy);
    const notes = this.policy?.notes || (typeof info?.releaseNotes === 'string' ? info.releaseNotes : '');
    this.set({ state: 'available', available: v, kind, critical: kind === 'critical', deadline: this.policy?.deadline, notes, message: undefined, progress: 0 });
    this.log('info', `Yeni sürüm bulundu: ${v} (${kind})`);
    this.startDownload();
  }

  private startDownload() {
    this.set({ state: 'downloading', progress: 0 });
    this.d.updater.downloadUpdate().catch((e: any) => this.onError(e));
  }

  private onDownloaded(info: any) {
    this.attempts = 0;
    this.downloadedVersion = String(info?.version || this.status.available || '');
    const snap = this.d.snapshot?.();
    this.set({
      state: 'downloaded', progress: 100,
      message: snap && !snap.ok ? `Veri anlık görüntüsü alınamadı: ${snap.message || ''}` : undefined,
    });
    this.log('info', `Güncelleme indirildi ve doğrulandı: ${this.downloadedVersion}`);
  }

  private onError(e: any) {
    const msg = String(e?.message || e || 'bilinmeyen hata').slice(0, 400);
    if (CHECKSUM_ERR.test(msg) || CHECKSUM_ERR.test(String(e?.code || ''))) {
      // Bozuk/doğrulanamayan paket: tekrar deneme yok, kurulum yok.
      this.set({ state: 'rejected', message: 'İndirilen güncelleme paketi doğrulanamadı ve REDDEDİLDİ. Mevcut sürüm değişmedi. Yöneticiye bildirin.', progress: undefined });
      this.log('error', 'Güncelleme paketi reddedildi: ' + msg);
      return;
    }
    this.attempts += 1;
    const max = this.d.maxAttempts ?? 5;
    this.log('warn', `Güncelleme hatası (${this.attempts}. deneme): ${msg}`);
    if (this.attempts >= max) {
      this.set({ state: 'error', message: `Güncelleme yapılamadı: ${msg}. Sonraki denetimde yeniden denenecek.`, attempts: this.attempts, retryAt: undefined });
      this.attempts = 0;
      return;
    }
    const wait = backoffMs(this.attempts - 1);
    const retryAt = (this.d.now ?? Date.now)() + wait;
    this.set({ state: 'error', message: `Güncelleme alınamadı (${msg}). ${Math.round(wait / 1000)} sn sonra yeniden denenecek.`, attempts: this.attempts, retryAt });
    if (this.timer) this.clearTimer(this.timer);
    this.timer = this.setTimer(() => { this.timer = null; this.busy = false; this.set({ state: 'idle' }); void this.check(); }, wait);
  }

  /** Kurulumu başlatır. Yalnızca indirilmiş+doğrulanmış paket varsa ve iş durumu güvenliyse. */
  install(work: WorkState): { ok: boolean; message: string } {
    if (this.status.state !== 'downloaded' || !this.downloadedVersion) return { ok: false, message: 'Kurulacak doğrulanmış bir güncelleme yok.' };
    const dec = decideInstall(work);
    if (!dec.allowed) return { ok: false, message: dec.reason };
    const snap = this.d.snapshot?.();
    if (snap && !snap.ok) return { ok: false, message: 'Güncelleme öncesi veri yedeği alınamadığı için kurulum durduruldu: ' + (snap.message || '') };
    this.log('info', `Güncelleme kuruluyor: ${this.downloadedVersion}`);
    // Sessiz kurulum (sihirbaz açılmaz) + bitince uygulamayı otomatik yeniden aç.
    this.d.updater.quitAndInstall(true, true);
    return { ok: true, message: 'Uygulama yeniden başlatılıyor…' };
  }
}
