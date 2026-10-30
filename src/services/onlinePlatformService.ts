/**
 * GAZİANTEPLİ TAHA USTA ERP - Online Yemek Platformları Servisi
 * -------------------------------------------------------------
 * Yemeksepeti, Trendyol Yemek ve GetirYemek platformlarının canlı
 * API entegrasyonu, webhook dinleme, durum yönetimi ve donanım tetikleyicisi.
 */

import { notify } from './notificationService';
import { printerService } from './printerService';

export type OnlinePlatformCode = 'YEMEKSEPETI' | 'TRENDYOL' | 'GETIR';
export type StoreAvailabilityStatus = 'OPEN' | 'BUSY' | 'CLOSED';
export type OnlineOrderStatus = 'BEKLIYOR' | 'HAZIRLANIYOR' | 'YOLA_CIKTI' | 'TESLIM_EDILDI' | 'IPTAL';
export type DeliveryModel = 'RESTAURANT_COURIER' | 'PLATFORM_COURIER';

export interface PlatformCredentials {
  // Yemeksepeti
  vendorId?: string;
  clientId?: string;
  clientSecret?: string;
  storeUuid?: string;

  // Trendyol Yemek
  supplierId?: string;
  apiKey?: string;
  secretKey?: string;

  // GetirYemek (appKey = "App Secret Key")
  restaurantSecretKey?: string;
  appKey?: string;
  restaurantId?: string;

  // Gelişmiş: platform dokümanındaki adresler (boşsa o işlem otomatik yapılmaz; "elle" olarak işaretlenir)
  apiBaseUrl?: string;   // Getir test ortamı için; boşsa canlı adres
  tokenUrl?: string;     // Yemeksepeti OAuth adresi; boşsa Partner API varsayılanı
  chainId?: string;      // Yemeksepeti zincir kimliği
  ordersUrl?: string;    // sipariş okuma (polling) adresi
  acceptUrl?: string;
  rejectUrl?: string;
  dispatchUrl?: string;
  deliverUrl?: string;
}

/** Sunucunun bir işlemi platforma iletme sonucu. MANUAL = otomatik değil, platform uygulamasında da yapılmalı. */
export type PlatformSyncState = 'OK' | 'FAILED' | 'MANUAL';
export interface ActionResult {
  success: boolean;
  message: string;
  platformSync?: PlatformSyncState;
  platformSyncMessage?: string;
}

export interface DiagnosticsLogEntry {
  id: number;
  created_at: string;
  platform: string;
  source: 'WEBHOOK' | 'POLL' | string;
  result: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE' | 'ERROR' | string;
  http_code: number;
  reason: string;
  header_names: string;
  order_ref: string;
  body_sample: string;
}
export interface Diagnostics {
  platforms: Array<{ platform: OnlinePlatformCode; enabled: boolean; hasSecret: boolean; configured: boolean; lastWebhookAt: string | null; orderCount: number }>;
  hiddenOrders: number;
  log: DiagnosticsLogEntry[];
}

export interface OnlinePlatformInfo {
  code: OnlinePlatformCode;
  name: string;
  isEnabled: boolean;
  storeStatus: StoreAvailabilityStatus;
  deliveryModel: DeliveryModel;
  credentials: PlatformCredentials;
  webhookSecret?: string;
  webhookUrl: string;
  badgeColor: {
    bg: string;
    border: string;
    text: string;
    pill: string;
  };
}

export type PlatformState = OnlinePlatformInfo;

export interface OnlineOrderItem {
  name: string;
  quantity: number;
  price: number;
  note?: string;
  options?: any[];
}

export interface OnlineOrder {
  id: string;
  platform: OnlinePlatformCode;
  platformCode?: OnlinePlatformCode;
  platformOrderId: string;
  customerName: string;
  customerPhone?: string;
  address: string;
  orderNote?: string;
  items: OnlineOrderItem[];
  totalAmount: number;
  paymentMethod: string;
  platformStatus?: string;
  status: OnlineOrderStatus;
  cancelReason?: string;
  createdAt: string;
  deliveryModel?: DeliveryModel | 'RESTAURANT' | 'PLATFORM';
  assignedCourierId?: string;
  assignedCourierName?: string;
  platformCourierName?: string;
  platformCourierPhone?: string;
  platformCourierEtaMinutes?: number;
  handoverCode?: string;
}

const STORAGE_KEY_PLATFORMS = 'gtu_online_platforms_v2';
const STORAGE_KEY_ORDERS = 'gtu_online_orders_v2';

const DEFAULT_PLATFORMS: Record<OnlinePlatformCode, OnlinePlatformInfo> = {
  YEMEKSEPETI: {
    code: 'YEMEKSEPETI',
    name: 'Yemeksepeti',
    isEnabled: false,
    storeStatus: 'OPEN',
    deliveryModel: 'RESTAURANT_COURIER',
    credentials: {
      vendorId: '',
      clientId: '',
      clientSecret: '',
      storeUuid: '',
    },
    webhookSecret: '',
    webhookUrl: '',
    badgeColor: {
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/40',
      text: 'text-rose-400',
      pill: 'bg-rose-600 text-white',
    },
  },
  TRENDYOL: {
    code: 'TRENDYOL',
    name: 'Trendyol Yemek',
    isEnabled: false,
    storeStatus: 'OPEN',
    deliveryModel: 'PLATFORM_COURIER',
    credentials: {
      supplierId: '',
      apiKey: '',
      secretKey: '',
    },
    webhookSecret: '',
    webhookUrl: '',
    badgeColor: {
      bg: 'bg-orange-500/15',
      border: 'border-orange-500/40',
      text: 'text-orange-400',
      pill: 'bg-orange-500 text-white',
    },
  },
  GETIR: {
    code: 'GETIR',
    name: 'GetirYemek',
    isEnabled: false,
    storeStatus: 'OPEN',
    deliveryModel: 'PLATFORM_COURIER',
    credentials: {
      restaurantSecretKey: '',
      appKey: '',
      restaurantId: '',
    },
    webhookSecret: '',
    webhookUrl: '',
    badgeColor: {
      bg: 'bg-purple-500/15',
      border: 'border-purple-500/40',
      text: 'text-purple-400',
      pill: 'bg-purple-600 text-white',
    },
  },
};

class OnlinePlatformService {
  private platforms: Record<OnlinePlatformCode, OnlinePlatformInfo>;
  private audioCtx: AudioContext | null = null;
  private alarmInterval: any = null;
  private isMuted: boolean = false;

  constructor() {
    this.platforms = this.loadLocalPlatforms();
  }

  private loadLocalPlatforms(): Record<OnlinePlatformCode, OnlinePlatformInfo> {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLATFORMS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          YEMEKSEPETI: { ...DEFAULT_PLATFORMS.YEMEKSEPETI, ...(parsed.YEMEKSEPETI || {}) },
          TRENDYOL: { ...DEFAULT_PLATFORMS.TRENDYOL, ...(parsed.TRENDYOL || {}) },
          GETIR: { ...DEFAULT_PLATFORMS.GETIR, ...(parsed.GETIR || {}) },
        };
      }
    } catch (e) {}
    return { ...DEFAULT_PLATFORMS };
  }

  private saveLocalPlatforms() {
    try {
      localStorage.setItem(STORAGE_KEY_PLATFORMS, JSON.stringify(this.platforms));
    } catch (e) {}
  }

  public getPlatforms(): OnlinePlatformInfo[] {
    return Object.values(this.platforms);
  }

  public getPlatform(code: OnlinePlatformCode): OnlinePlatformInfo {
    return this.platforms[code] || DEFAULT_PLATFORMS[code];
  }

  public getEnabledPlatforms(): OnlinePlatformInfo[] {
    return Object.values(this.platforms).filter(p => p.isEnabled);
  }

  public isAnyPlatformEnabled(): boolean {
    return Object.values(this.platforms).some(p => p.isEnabled);
  }

  /**
   * Sunucu API URL'sini döndürür
   */
  // Kasa ile aynı sunucu ayarı kullanılır; sabit bir alan adına düşülmez.
  private getApiUrl(): string {
    const candidates = ['gtu_sync_api_url', 'CUSTOM_API_SYNC_URL'];
    for (const key of candidates) {
      const saved = localStorage.getItem(key);
      if (saved && saved.startsWith('http')) {
        const trimmed = saved.replace('/index.php', '').replace(/\/$/, '');
        return `${trimmed}/index.php`;
      }
    }
    return '';
  }

  /** Sunucu çağrısı: ağ/HTTP/uygulama hatasını açıkça döndürür (asla sessizce yutmaz). */
  private async callServer(action: string, body?: object, method: 'POST' | 'GET' = 'POST'): Promise<{ ok: boolean; data: any; error: string }> {
    const base = this.getApiUrl();
    if (!base) return { ok: false, data: null, error: 'Sunucu adresi ayarlanmamış (Restoran & Donanım Ayarları › Bulut & Yedekleme).' };
    try {
      const res = await fetch(`${base}?action=${action}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      let data: any = null;
      try { data = await res.json(); } catch {}
      if (res.status === 401) return { ok: false, data, error: 'Sunucu kasa anahtarını kabul etmedi (401). Bulut & Yedekleme ekranındaki Kasa API Anahtarını kontrol edin.' };
      if (!res.ok || !data || data.success === false) return { ok: false, data, error: (data && (data.error || data.message)) || `Sunucu hatası (HTTP ${res.status})` };
      return { ok: true, data, error: '' };
    } catch (e: any) {
      return { ok: false, data: null, error: 'Sunucuya ulaşılamadı: ' + (e?.message || 'bağlantı hatası') };
    }
  }

  /** İşlem sonucunu kullanıcıya doğru anlatan metin. */
  private describeSync(r: ActionResult): string {
    if (r.platformSync === 'OK') return ' Platforma iletildi.';
    if (r.platformSync === 'MANUAL') return ' DİKKAT: Platforma otomatik iletilmedi — ' + (r.platformSyncMessage || 'işlemi platform uygulamasında da yapın.');
    if (r.platformSync === 'FAILED') return ' DİKKAT: Platforma İLETİLEMEDİ — ' + (r.platformSyncMessage || '') + ' İşlemi platform uygulamasında yapın.';
    return '';
  }

  /**
   * Platform Aktif/Pasif durumunu değiştirir. Sunucu onaylamadan "başarılı" sayılmaz.
   */
  public async togglePlatform(code: OnlinePlatformCode, isEnabled: boolean): Promise<ActionResult> {
    const r = await this.callServer('toggle_online_platform', { platform: code, isEnabled });
    if (r.ok && this.platforms[code]) {
      this.platforms[code].isEnabled = isEnabled;
      this.saveLocalPlatforms();
    }
    return { success: r.ok, message: r.ok ? `${code} ${isEnabled ? 'aktif' : 'pasif'} yapıldı.` : r.error };
  }

  /**
   * Restoran mağaza durumu (OPEN/BUSY/CLOSED). Platforma iletim sonucu ayrıca raporlanır.
   */
  public async setStoreStatus(code: OnlinePlatformCode | 'ALL', status: StoreAvailabilityStatus): Promise<ActionResult> {
    const r = await this.callServer('update_online_store_status', { platform: code, status });
    if (r.ok) {
      if (code === 'ALL') {
        (['YEMEKSEPETI', 'TRENDYOL', 'GETIR'] as OnlinePlatformCode[]).forEach(k => { if (this.platforms[k]) this.platforms[k].storeStatus = status; });
      } else if (this.platforms[code]) {
        this.platforms[code].storeStatus = status;
      }
      this.saveLocalPlatforms();
    }
    return { success: r.ok, message: r.ok ? (r.data?.message || 'Mağaza durumu kaydedildi.') : r.error };
  }

  public async setDeliveryModel(code: OnlinePlatformCode, deliveryModel: DeliveryModel): Promise<ActionResult> {
    const r = await this.callServer('update_delivery_model', { platform: code, deliveryModel });
    if (r.ok && this.platforms[code]) {
      this.platforms[code].deliveryModel = deliveryModel;
      this.saveLocalPlatforms();
    }
    return { success: r.ok, message: r.ok ? 'Teslimat modeli güncellendi.' : r.error };
  }

  /**
   * Kimlik/gizli anahtar ayarlarını sunucuya kaydeder. KAYDETMEK BAĞLANTIYI DOĞRULAMAZ.
   */
  public async savePlatformConfig(code: OnlinePlatformCode, config: Partial<OnlinePlatformInfo>): Promise<ActionResult> {
    if (this.platforms[code]) {
      this.platforms[code] = {
        ...this.platforms[code],
        ...config,
        deliveryModel: config.deliveryModel || this.platforms[code].deliveryModel || 'RESTAURANT_COURIER',
        credentials: { ...this.platforms[code].credentials, ...(config.credentials || {}) },
      };
      this.saveLocalPlatforms();
    }
    const r = await this.callServer('save_online_platform_config', {
      platform: code,
      isEnabled: config.isEnabled,
      storeStatus: config.storeStatus,
      deliveryModel: this.platforms[code]?.deliveryModel || config.deliveryModel,
      credentials: this.platforms[code]?.credentials || {},
      webhookSecret: this.platforms[code]?.webhookSecret ?? config.webhookSecret,
    });
    return { success: r.ok, message: r.ok ? 'Ayarlar sunucuya kaydedildi. Bağlantıyı doğrulamak için "Bağlantıyı Test Et" kullanın.' : 'Sunucuya KAYDEDİLEMEDİ: ' + r.error };
  }

  /**
   * GERÇEK bağlantı testi: sunucu platforma gerçekten istek atar. Platform yanıtı gelmedikçe "başarılı" denmez.
   */
  public async testConnection(code: OnlinePlatformCode, credentials?: PlatformCredentials): Promise<{ success: boolean; message: string }> {
    const p = this.platforms[code];
    // Ekranda yazılmış ama henüz kaydedilmemiş bilgiler de test edilir (eskiden yalnızca kayıtlı olanlar gidiyordu).
    const r = await this.callServer('test_online_connection', { platform: code, credentials: credentials || p.credentials });
    if (r.ok) return { success: Boolean(r.data.success), message: r.data.message || 'Bağlantı doğrulandı.' };
    // Sunucu yanıtı var ama doğrulama başarısızsa asıl mesajı göster
    const msg = r.data?.message || r.error;
    return { success: false, message: msg };
  }

  /** Webhook/polling tanı kaydı: sipariş neden gelmedi? */
  public async getDiagnostics(limit = 40): Promise<{ ok: boolean; data?: Diagnostics; error?: string }> {
    const r = await this.callServer(`get_online_diagnostics&limit=${limit}`, undefined, 'GET');
    return r.ok ? { ok: true, data: r.data as Diagnostics } : { ok: false, error: r.error };
  }

  /** Sunucudan platformlara sipariş sorgusu yaptırır (webhook gelmezse yedek yol). */
  public async pollOrders(): Promise<{ ok: boolean; results?: Record<string, { fetched: number; new: number; error: string | null; skipped: string | null }>; error?: string }> {
    const r = await this.callServer('poll_online_orders', {});
    return r.ok ? { ok: true, results: r.data.results } : { ok: false, error: r.error };
  }

  /** Platformlara kaydedilecek webhook adresleri (kullanıcının KENDİ sunucusundan türetilir). */
  public getWebhookUrls(code: OnlinePlatformCode): Array<{ label: string; url: string }> {
    const base = this.getApiUrl().replace(/\/index\.php$/, '');
    if (!base) return [];
    if (code === 'GETIR') {
      return [
        { label: 'Yeni sipariş URL', url: `${base}/online/webhook.php?platform=GETIR&event=new` },
        { label: 'Sipariş iptal URL', url: `${base}/online/webhook.php?platform=GETIR&event=cancel` },
      ];
    }
    if (code === 'TRENDYOL') {
      return [{ label: 'Webhook URL', url: `${base}/online/webhook.php?platform=TRENDYOL` }];
    }
    return [{ label: 'POS Plugin taban adresi (Yemeksepeti bu adrese /order/{remoteId} gönderir)', url: base }];
  }

  /**
   * Sipariş listesini sunucudan çeker. Sunucuya ulaşılamazsa SON BİLİNEN liste döner ve `stale` işaretlenir.
   */
  public async fetchOrders(statusFilter: 'ACTIVE' | 'HISTORY' | 'ALL' = 'ACTIVE', platformFilter: 'ALL' | OnlinePlatformCode = 'ALL'): Promise<OnlineOrder[]> {
    const r = await this.callServer(`get_online_orders&status=${statusFilter}&platform=${platformFilter}`, undefined, 'GET');
    let fetched: OnlineOrder[] = [];
    if (r.ok && Array.isArray(r.data.orders)) {
      fetched = r.data.orders;
      this.lastHiddenCount = Number(r.data.hiddenCount) || 0;
      try { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(fetched)); } catch {}
    } else {
      try { fetched = JSON.parse(localStorage.getItem(STORAGE_KEY_ORDERS) || '[]'); } catch {}
    }
    const enabledCodes = new Set(this.getEnabledPlatforms().map(p => p.code));
    let filtered = fetched.filter(o => enabledCodes.has(o.platform));
    if (statusFilter === 'ACTIVE') filtered = filtered.filter(o => ['BEKLIYOR', 'HAZIRLANIYOR', 'YOLA_CIKTI'].includes(o.status));
    else if (statusFilter === 'HISTORY') filtered = filtered.filter(o => ['TESLIM_EDILDI', 'IPTAL'].includes(o.status));
    if (platformFilter !== 'ALL') filtered = filtered.filter(o => o.platform === platformFilter);
    return filtered;
  }

  public lastHiddenCount = 0;

  /**
   * Siparişi onaylar. Sunucu onaylamazsa HİÇBİR yerel durum değişmez ve fiş basılmaz.
   * Platforma iletim sonucu (OK/FAILED/MANUAL) ayrıca döner.
   */
  public async acceptOrder(order: OnlineOrder): Promise<ActionResult> {
    const r = await this.callServer('accept_online_order', {
      orderId: order.id,
      platform: order.platform,
      deliveryModel: order.deliveryModel,
      assignedCourierId: order.assignedCourierId,
      handoverCode: order.handoverCode,
    });
    if (!r.ok) return { success: false, message: `Sipariş onaylanamadı: ${r.error}` };
    this.updateLocalOrderStatus(order.id, 'HAZIRLANIYOR');
    const res: ActionResult = { success: true, message: `[${order.platform}] #${order.platformOrderId} onaylandı.`, platformSync: r.data.platformSync, platformSyncMessage: r.data.platformSyncMessage };
    res.message += this.describeSync(res);
    return res;
  }

  public async assignCourier(orderId: string, courierId: string, courierName: string, platform?: OnlinePlatformCode): Promise<ActionResult> {
    const r = await this.callServer('assign_courier', { orderId, courierId, courierName, platform });
    return { success: r.ok, message: r.ok ? 'Kurye atandı.' : `Kurye atanamadı: ${r.error}` };
  }

  public async rejectOrder(orderId: string, reason: string, platform?: OnlinePlatformCode): Promise<ActionResult> {
    const r = await this.callServer('reject_online_order', { orderId, platform, cancelReason: reason });
    if (!r.ok) return { success: false, message: `Sipariş iptal edilemedi: ${r.error}` };
    this.updateLocalOrderStatus(orderId, 'IPTAL', reason);
    const res: ActionResult = { success: true, message: 'Sipariş iptal edildi.', platformSync: r.data.platformSync, platformSyncMessage: r.data.platformSyncMessage };
    res.message += this.describeSync(res);
    return res;
  }

  public async dispatchOrder(orderId: string, platform?: OnlinePlatformCode): Promise<ActionResult> {
    const r = await this.callServer('dispatch_online_order', { orderId, platform });
    if (!r.ok) return { success: false, message: `Durum güncellenemedi: ${r.error}` };
    this.updateLocalOrderStatus(orderId, 'YOLA_CIKTI');
    const res: ActionResult = { success: true, message: 'Sipariş yola çıktı olarak işaretlendi.', platformSync: r.data.platformSync, platformSyncMessage: r.data.platformSyncMessage };
    res.message += this.describeSync(res);
    return res;
  }

  public async deliverOrder(orderId: string, platform?: OnlinePlatformCode): Promise<ActionResult> {
    const r = await this.callServer('deliver_online_order', { orderId, platform });
    if (!r.ok) return { success: false, message: `Durum güncellenemedi: ${r.error}` };
    this.updateLocalOrderStatus(orderId, 'TESLIM_EDILDI');
    const res: ActionResult = { success: true, message: 'Sipariş teslim edildi olarak kapatıldı.', platformSync: r.data.platformSync, platformSyncMessage: r.data.platformSyncMessage };
    res.message += this.describeSync(res);
    return res;
  }

  /**
   * Yerel durum güncelleme yardımcısı
   */
  private updateLocalOrderStatus(orderId: string, newStatus: OnlineOrderStatus, cancelReason?: string) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
      if (saved) {
        const list: OnlineOrder[] = JSON.parse(saved);
        const updated = list.map(o => {
          if (o.id === orderId || o.platformOrderId === orderId) {
            return {
              ...o,
              status: newStatus,
              ...(cancelReason ? { cancelReason } : {}),
            };
          }
          return o;
        });
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
      }
    } catch (e) {}
  }

  /**
   * Yeni Sipariş Geldiğinde Kasa Terminalinde Çalacak Kesintisiz Sesli Alarm
   */
  public startContinuousAlarm() {
    if (this.isMuted || this.alarmInterval) return;

    const playTone = () => {
      try {
        if (!this.audioCtx) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) this.audioCtx = new AudioContextClass();
        }
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // İki tonlu dikkat çekici restoran zil sesi (880Hz -> 1320Hz)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.55);
      } catch (e) {}
    };

    playTone();
    this.alarmInterval = setInterval(playTone, 1600);
  }

  public stopContinuousAlarm() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopContinuousAlarm();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const onlinePlatformService = new OnlinePlatformService();
