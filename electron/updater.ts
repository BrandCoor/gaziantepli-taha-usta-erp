/**
 * Windows otomatik güncelleme (electron-updater, "generic" sağlayıcı = kendi HTTPS adresiniz).
 *
 * Güvenlik/dayanıklılık:
 *  - Paket özeti (SHA-512) latest.yml'den doğrulanır (electron-updater); uyuşmazsa paket REDDEDİLİR.
 *  - İmzalı yayında Windows kod imzası da denetlenir (yalnızca sertifika ile imzalanmışsa; bkz. docs/updates.md).
 *  - İndirme arka planda; kurulum YALNIZCA kullanıcı onayıyla ya da açık adisyon yokken güvenli anda.
 *  - Kurulumdan önce işletme verisinin tutarlı anlık görüntüsü (SQLite VACUUM INTO) alınır; alınamazsa kurulmaz.
 *  - Veri klasörü (userData) ve yedekler kurulumda silinmez (NSIS deleteAppDataOnUninstall=false).
 */
import { app, BrowserWindow, net } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import electronUpdater from 'electron-updater';
import { KvStore } from './kvStore';
import { FileLogger } from './logger';
import {
  UpdateController, UpdaterLike, UpdateStatus, UpdatePolicy, WorkState, parsePolicy, resolveFeedUrl, normalizeFeedUrl, classify,
} from './updateLogic';

const { autoUpdater } = electronUpdater as unknown as { autoUpdater: any };

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const FIRST_CHECK_MS = 45 * 1000;
export const FEED_KEY = 'gtu_update_feed_url';

interface Deps {
  getKv: () => KvStore | null;
  log: () => FileLogger;
  getWindow: () => BrowserWindow | null;
}

let controller: UpdateController | null = null;
let deps: Deps;
let feedUrl: string | null = null;
let feedSource = 'yok';
let policyCache: UpdatePolicy | null = null;

function readPackagedFeed(): string | null {
  try {
    const f = path.join(process.resourcesPath || '', 'update-config.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).feedUrl || null;
  } catch {}
  return null;
}

function resolveSources(): { url: string | null; source: string } {
  const kv = deps.getKv();
  let userConfigured: string | null = null, apiBase: string | null = null;
  try {
    const all = kv?.getAll() || {};
    userConfigured = all[FEED_KEY] || null;
    apiBase = all['gtu_sync_api_url'] || all['CUSTOM_API_SYNC_URL'] || null;
  } catch {}
  return resolveFeedUrl({ userConfigured, env: process.env.GTU_UPDATE_URL || null, packaged: readPackagedFeed(), apiBase });
}

async function fetchPolicy(): Promise<UpdatePolicy | null> {
  if (!feedUrl) return null;
  try {
    const res = await net.fetch(feedUrl + 'update-policy.json', { cache: 'no-store' } as any);
    if (!res.ok) return null;
    policyCache = parsePolicy(await res.text());
    return policyCache;
  } catch {
    return null;
  }
}

/** Kurulumdan önce veri anlık görüntüsü; son 5 tanesi saklanır. */
function snapshot(): { ok: boolean; message?: string } {
  try {
    const kv = deps.getKv();
    if (!kv) return { ok: false, message: 'kalıcı depo açık değil' };
    const dir = path.join(app.getPath('userData'), 'data', 'guncelleme-oncesi');
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const file = path.join(dir, `kasa_${app.getVersion()}_${stamp}.db`);
    kv.snapshotTo(file);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) return { ok: false, message: 'anlık görüntü dosyası oluşmadı' };
    const olds = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
    for (const f of olds.slice(0, Math.max(0, olds.length - 5))) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
    deps.log().info('Güncelleme öncesi veri anlık görüntüsü alındı: ' + file);
    return { ok: true };
  } catch (e: any) {
    deps.log().error('Güncelleme öncesi anlık görüntü alınamadı', e);
    return { ok: false, message: e?.message || String(e) };
  }
}

function push(status: UpdateStatus) {
  const w = deps.getWindow();
  if (w && !w.isDestroyed()) w.webContents.send('update-status', status);
}

export function initUpdater(d: Deps) {
  deps = d;
  const current = app.getVersion();
  const mk = (): UpdaterLike => autoUpdater;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true; // kullanıcı uygulamayı kapattığında bekleyen güncelleme kurulur
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = {
    info: (m: any) => d.log().info('[updater] ' + String(m)),
    warn: (m: any) => d.log().warn('[updater] ' + String(m)),
    error: (m: any) => d.log().error('[updater] ' + String(m)),
    debug: () => {},
  };

  controller = new UpdateController({
    updater: mk(),
    current,
    fetchPolicy,
    snapshot,
    log: (lvl, msg) => (d.log() as any)[lvl]?.('[güncelleme] ' + msg),
  });
  controller.onStatus(push);

  applyFeed();

  if (!app.isPackaged) {
    controller.disable('Geliştirme sürümünde otomatik güncelleme kapalıdır.', feedSource);
    return;
  }
  if (!feedUrl) {
    controller.disable('Güncelleme kaynağı tanımlı değil. Ayarlar › Güncelleme bölümünden adresi girin (docs/updates.md).', feedSource);
    return;
  }
  setTimeout(() => void controller!.check(), FIRST_CHECK_MS);
  setInterval(() => void controller!.check(), CHECK_EVERY_MS);
}

function applyFeed() {
  const r = resolveSources();
  feedUrl = r.url; feedSource = r.source;
  if (feedUrl) autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl });
}

export const updaterApi = {
  status: (): UpdateStatus & { feedUrl: string | null } => ({ ...(controller?.getStatus() ?? { state: 'disabled', current: app.getVersion(), kind: 'none' }), feedSource, feedUrl }),
  check: async () => {
    if (!controller) return { state: 'disabled', current: app.getVersion(), kind: 'none' } as UpdateStatus;
    applyFeed();
    if (app.isPackaged && feedUrl) controller.enable(feedSource);
    return controller.check();
  },
  install: (work: WorkState) => (controller ? controller.install(work) : { ok: false, message: 'Güncelleme sistemi hazır değil.' }),
  setFeed: (raw: string): { ok: boolean; message: string } => {
    const kv = deps.getKv();
    const v = (raw || '').trim();
    if (v === '') { kv?.remove(FEED_KEY); applyFeed(); return { ok: true, message: 'Özel güncelleme adresi kaldırıldı.' }; }
    const url = normalizeFeedUrl(v);
    if (!url) return { ok: false, message: 'Adres https:// ile başlamalı (parola içermemeli).' };
    kv?.set(FEED_KEY, url);
    applyFeed();
    return { ok: true, message: 'Güncelleme adresi kaydedildi: ' + url };
  },
  /** Bekleyen (indirilmiş) güncelleme varsa uygulama kapanırken veri anlık görüntüsü al. */
  snapshotIfPending: () => { if (controller?.getStatus().state === 'downloaded') snapshot(); },
  classify,
  policy: () => policyCache,
};
