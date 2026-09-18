/**
 * GAZİANTEPLİ TAHA USTA ERP - Online Yemek Platformları Servisi
 * -------------------------------------------------------------
 * Yemeksepeti, Trendyol Yemek ve GetirYemek platformlarının canlı
 * API entegrasyonu, webhook dinleme, durum yönetimi ve donanım tetikleyicisi.
 */

import { notify } from './notificationService';
import { printerService } from './printerService';
import { restaurantDataService } from './restaurantDataService';

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

  // GetirYemek
  restaurantSecretKey?: string;
  appKey?: string;
  restaurantId?: string;
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

// Kimlik bilgileri ve webhook adresleri burada ASLA sabit yazılmaz: bu dosya derlenip
// istemciye gönderilir, buraya yazılan her değer kurulu her makinede okunabilir hale gelir.
// Değerler Ayarlar > Platform API ekranından girilir.
const DEFAULT_PLATFORMS: Record<OnlinePlatformCode, OnlinePlatformInfo> = {
  YEMEKSEPETI: {
    code: 'YEMEKSEPETI',
    name: 'Yemeksepeti',
    isEnabled: false,
    storeStatus: 'CLOSED',
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
    storeStatus: 'CLOSED',
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
    storeStatus: 'CLOSED',
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

  /**
   * Platform Aktif/Pasif durumunu değiştirir (Feature Toggling)
   * Pasif edilen platform menülerden ve listelerden tamamen gizlenir.
   */
  public async togglePlatform(code: OnlinePlatformCode, isEnabled: boolean): Promise<boolean> {
    if (this.platforms[code]) {
      this.platforms[code].isEnabled = isEnabled;
      this.saveLocalPlatforms();
    }

    try {
      await fetch(`${this.getApiUrl()}?action=toggle_online_platform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: code, isEnabled }),
      });
    } catch (e) {}

    return true;
  }

  /**
   * Restoran Mağaza Durumunu Değiştirir (OPEN, BUSY, CLOSED)
   */
  public async setStoreStatus(code: OnlinePlatformCode | 'ALL', status: StoreAvailabilityStatus): Promise<boolean> {
    if (code === 'ALL') {
      (['YEMEKSEPETI', 'TRENDYOL', 'GETIR'] as OnlinePlatformCode[]).forEach(k => {
        if (this.platforms[k]) this.platforms[k].storeStatus = status;
      });
    } else if (this.platforms[code]) {
      this.platforms[code].storeStatus = status;
    }
    this.saveLocalPlatforms();

    try {
      await fetch(`${this.getApiUrl()}?action=update_online_store_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: code, status }),
      });
    } catch (e) {}

    return true;
  }

  /**
   * Platform Teslimat Modelini Değiştirir (Restoran Kuryesi vs. Platform Kuryesi)
   */
  /**
   * Kurye modeli iki ayrı yerde tutuluyordu: burada ('RESTAURANT_COURIER'/
   * 'PLATFORM_COURIER') ve restaurantDataService içindeki FoodPlatformsConfig'de
   * ('RESTAURANT'/'PLATFORM'). Ayar ekranı yalnızca buraya yazdığı için sipariş
   * ekranı eski değeri gösteriyor ve iki ekran birbiriyle çelişiyordu.
   * Değişiklik artık her iki depoya birden yazılır.
   */
  private mirrorDeliveryModelToRestaurantConfig(code: OnlinePlatformCode, deliveryModel: DeliveryModel): void {
    try {
      const simple = deliveryModel === 'RESTAURANT_COURIER' ? 'RESTAURANT' : 'PLATFORM';
      const config = restaurantDataService.getFoodPlatformsConfig();
      const key = code === 'TRENDYOL' ? 'trendyol' : code === 'GETIR' ? 'getir' : 'yemeksepeti';
      if (config[key].deliveryModel === simple) return;
      restaurantDataService.saveFoodPlatformsConfig({
        ...config,
        [key]: { ...config[key], deliveryModel: simple }
      });
    } catch (e) {}
  }

  public async setDeliveryModel(code: OnlinePlatformCode, deliveryModel: DeliveryModel): Promise<boolean> {
    if (this.platforms[code]) {
      this.platforms[code].deliveryModel = deliveryModel;
      this.saveLocalPlatforms();
      this.mirrorDeliveryModelToRestaurantConfig(code, deliveryModel);
    }

    try {
      await fetch(`${this.getApiUrl()}?action=update_delivery_model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: code, deliveryModel }),
      });
    } catch (e) {}

    return true;
  }

  /**
   * Platform kimlik parametrelerini kaydeder
   */
  public async savePlatformConfig(code: OnlinePlatformCode, config: Partial<OnlinePlatformInfo>): Promise<boolean> {
    if (this.platforms[code]) {
      this.platforms[code] = {
        ...this.platforms[code],
        ...config,
        deliveryModel: config.deliveryModel || this.platforms[code].deliveryModel || 'RESTAURANT_COURIER',
        credentials: {
          ...this.platforms[code].credentials,
          ...(config.credentials || {}),
        },
      };
      this.saveLocalPlatforms();
      this.mirrorDeliveryModelToRestaurantConfig(code, this.platforms[code].deliveryModel);
    }

    try {
      await fetch(`${this.getApiUrl()}?action=save_online_platform_config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: code,
          isEnabled: config.isEnabled,
          storeStatus: config.storeStatus,
          deliveryModel: this.platforms[code]?.deliveryModel || config.deliveryModel,
          credentials: this.platforms[code].credentials,
          webhookSecret: config.webhookSecret,
        }),
      });
    } catch (e) {}

    return true;
  }

  /**
   * Platform paneline girilecek webhook adresi. Sabit bir alan adına bağlanmaz;
   * yapılandırılan senkronizasyon sunucusunun yanındaki webhook.php'den türetilir.
   */
  public getWebhookUrl(code: OnlinePlatformCode): string {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) return '';
    const base = apiUrl.replace(/index\.php.*$/, '');
    return `${base}online/webhook.php?platform=${code}`;
  }

  private getMissingCredentialFields(code: OnlinePlatformCode): string[] {
    const c = this.platforms[code]?.credentials || {};
    if (code === 'TRENDYOL') {
      return [
        !c.supplierId && 'Satıcı ID',
        !c.apiKey && 'API Key',
        !c.secretKey && 'API Secret',
      ].filter(Boolean) as string[];
    }
    if (code === 'GETIR') {
      return [
        !c.appKey && 'App Key',
        !c.restaurantSecretKey && 'Restoran Secret Key',
      ].filter(Boolean) as string[];
    }
    return [
      !c.clientId && 'Client ID',
      !c.clientSecret && 'Client Secret',
      !c.vendorId && 'Vendor ID',
    ].filter(Boolean) as string[];
  }

  /**
   * Bağlantıyı sunucu üzerinden test eder. Başarı YALNIZCA sunucu gerçekten
   * doğrulama yaptığında bildirilir; ulaşılamayan sunucu veya ağ hatası
   * hiçbir koşulda "başarılı" sayılmaz.
   */
  public async testConnection(code: OnlinePlatformCode): Promise<{ success: boolean; message: string }> {
    const p = this.platforms[code];

    const missing = this.getMissingCredentialFields(code);
    if (missing.length > 0) {
      return {
        success: false,
        message: `${p.name} için eksik bilgiler: ${missing.join(', ')}. Ayarlar > Platform API ekranından doldurun.`,
      };
    }

    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      return {
        success: false,
        message: 'Senkronizasyon sunucusu ayarlanmadı. Ayarlar > Sistem & Yedekleme bölümünden kendi sunucu adresinizi girin.'
      };
    }

    try {
      const res = await fetch(`${apiUrl}?action=test_online_connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: code,
          ...p.credentials,
        }),
      });

      if (!res.ok) {
        return {
          success: false,
          message: `Sunucu ${res.status} kodu döndürdü (${apiUrl}). Senkronizasyon adresini ve sunucudaki api/online dosyalarını kontrol edin.`,
        };
      }

      const data = await res.json();
      return {
        success: Boolean(data.success),
        message: data.message || (data.success ? 'Bağlantı doğrulandı.' : 'Sunucu bağlantıyı doğrulayamadı.'),
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Sunucuya ulaşılamadı (${apiUrl}): ${e?.message || 'ağ hatası'}`,
      };
    }
  }

  /**
   * Online Siparişleri Sunucudan ve Yerel Depodan Çeker
   */
  /**
   * Sunucuya istek gonderir ve GERCEK sonucu dondurur.
   * Onceden her istek try/catch icinde yutuluyor ve islem her halukarda
   * "basarili" sayiliyordu: platforma hic ulasmamis bir onay/iptal kasada
   * onaylanmis gorunuyordu.
   */
  private async postToServer(action: string, payload: any): Promise<{ ok: boolean; message: string; data?: any }> {
    const base = this.getApiUrl();
    if (!base) {
      return { ok: false, message: 'Senkronizasyon sunucusu ayarlanmadı. Kasa ayarlarından sunucu adresini girin.' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${base}?action=${encodeURIComponent(action)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      let data: any = null;
      try { data = await res.json(); } catch {}

      if (!res.ok) {
        return { ok: false, message: data?.message || data?.error || `Sunucu ${res.status} hatası döndürdü.`, data };
      }
      if (data && data.success === false) {
        return { ok: false, message: data.message || data.error || 'Sunucu isteği reddetti.', data };
      }

      return { ok: true, message: data?.message || 'İşlem sunucuya iletildi.', data };
    } catch (e: any) {
      const reason = e?.name === 'AbortError' ? 'Sunucu zaman aşımına uğradı.' : (e?.message || 'Sunucuya ulaşılamadı.');
      return { ok: false, message: reason };
    }
  }

  public async fetchOrders(statusFilter: 'ACTIVE' | 'HISTORY' | 'ALL' = 'ACTIVE', platformFilter: 'ALL' | OnlinePlatformCode = 'ALL'): Promise<OnlineOrder[]> {
    let fetchedOrders: OnlineOrder[] = [];
    // Sunucu "sipariş yok" dediginde bu bir HATA DEGILDIR. Onceden bos sonuc
    // da basarisizlik sayilip yerel depodaki eski siparisler geri
    // yukleniyordu; bu yuzden hic siparis yokken ekranda siparis gorunuyordu.
    let serverAnswered = false;
    const base = this.getApiUrl();

    if (base) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(
          `${base}?action=get_online_orders&status=${statusFilter}&platform=${platformFilter}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.orders)) {
            fetchedOrders = data.orders;
            serverAnswered = true;
          }
        }
      } catch (e) {
        console.warn('[Online] Sipariş listesi sunucudan alınamadı:', e);
      }
    }

    // Yerel depoya YALNIZCA sunucuya ulasilamadiginda dusulur.
    if (!serverAnswered) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
        if (saved) fetchedOrders = JSON.parse(saved);
      } catch (e) {}
    }

    // Filtreleme kuralları:
    // 1. Pasif olan platformların siparişlerini TAMAMEN gizle
    const enabledCodes = new Set(this.getEnabledPlatforms().map(p => p.code));
    let filtered = fetchedOrders.filter(o => enabledCodes.has(o.platform));

    // 2. Durum Filtresi
    if (statusFilter === 'ACTIVE') {
      filtered = filtered.filter(o => ['BEKLIYOR', 'HAZIRLANIYOR', 'YOLA_CIKTI'].includes(o.status));
    } else if (statusFilter === 'HISTORY') {
      filtered = filtered.filter(o => ['TESLIM_EDILDI', 'IPTAL'].includes(o.status));
    }

    // 3. Platform Filtresi
    if (platformFilter !== 'ALL') {
      filtered = filtered.filter(o => o.platform === platformFilter);
    }

    // Kalıcı depolamayı da güncel tut
    try {
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(fetchedOrders));
    } catch (e) {}

    return filtered;
  }

  /**
   * Kasiyer Siparişi Onaylar:
   * - Platform API'sine iletilir
   * - Akıllı fırın/ocak/kurye yazıcılarına çıktı gönderilir
   * - Sipariş durumu 'HAZIRLANIYOR' olur
   */
  public async acceptOrder(order: OnlineOrder): Promise<{ success: boolean; message: string; ackId?: string }> {
    const result = await this.postToServer('accept_online_order', {
      orderId: order.id,
      platform: order.platform,
      deliveryModel: order.deliveryModel,
      assignedCourierId: order.assignedCourierId,
      assignedCourierName: order.assignedCourierName,
      platformCourierName: order.platformCourierName,
      platformCourierPhone: order.platformCourierPhone,
      handoverCode: order.handoverCode,
    });

    // Durumu güncelle (mutfak calismaya baslasin diye yerel durum her halukarda ilerler)
    this.updateLocalOrderStatus(order.id, 'HAZIRLANIYOR');

    // Otomatik İstasyon & Kurye Çıktısı (Lojistik Model Ayrımı ile)
    try {
      await printerService.printOnlineOrder({
        platform: order.platform,
        platformOrderId: order.platformOrderId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address: order.address,
        orderNote: order.orderNote,
        items: order.items,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        deliveryModel: order.deliveryModel,
        assignedCourierName: order.assignedCourierName,
        platformCourierName: order.platformCourierName,
        platformCourierPhone: order.platformCourierPhone,
        handoverCode: order.handoverCode,
      });
    } catch (pErr) {
      console.warn('Yazıcı çıktısı uyarısı:', pErr);
    }

    const modelLabel = order.deliveryModel === 'PLATFORM_COURIER' ? 'Platform Kuryesi' : 'Restoran Kuryesi';

    if (!result.ok) {
      return {
        success: false,
        message: `Sipariş kasada onaylandı ve fişleri basıldı (${modelLabel}), ANCAK platforma iletilemedi: ${result.message} Siparişi platformun kendi panelinden de onaylayın.`,
      };
    }

    return {
      success: true,
      message: `[${order.platform}] #${order.platformOrderId} onaylandı (${modelLabel}). İstasyon & teslimat fişleri yazdırıldı.`,
      ackId: result.data?.ackId || result.data?.acknowledgementId,
    };
  }

  /**
   * Siparişe Restoran Kuryesi Atar
   */
  public async assignCourier(orderId: string, courierId: string, courierName: string, platform?: OnlinePlatformCode): Promise<{ success: boolean; message: string }> {
    const result = await this.postToServer('assign_courier', { orderId, courierId, courierName, platform });

    // Yerel depoda güncelle
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
      if (saved) {
        const list: OnlineOrder[] = JSON.parse(saved);
        const updated = list.map(o => {
          if (o.id === orderId || o.platformOrderId === orderId) {
            return {
              ...o,
              assignedCourierId: courierId,
              assignedCourierName: courierName,
            };
          }
          return o;
        });
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
      }
    } catch (e) {}

    return {
      success: result.ok,
      message: result.ok
        ? `Kurye [${courierName}] siparişe atandı.`
        : `Kurye kasada atandı ancak platforma iletilemedi: ${result.message}`,
    };
  }

  /**
   * Kasiyer Siparişi İptal Eder (Zorunlu Sebep ile)
   */
  public async rejectOrder(orderId: string, reason: string, platform?: OnlinePlatformCode): Promise<{ success: boolean; message: string }> {
    const result = await this.postToServer('reject_online_order', { orderId, platform, cancelReason: reason });

    this.updateLocalOrderStatus(orderId, 'IPTAL', reason);

    return {
      success: result.ok,
      message: result.ok
        ? `İptal gerekçesi (${reason}) platform merkezine iletildi.`
        : `Sipariş kasada iptal edildi ANCAK platforma iletilemedi: ${result.message} İptali platformun kendi panelinden de bildirin.`,
    };
  }

  /**
   * Kuryeye Verildi / Yola Çıktı
   */
  public async dispatchOrder(orderId: string, platform?: OnlinePlatformCode): Promise<{ success: boolean; message: string }> {
    const result = await this.postToServer('dispatch_online_order', { orderId, platform });
    this.updateLocalOrderStatus(orderId, 'YOLA_CIKTI');
    return {
      success: result.ok,
      message: result.ok ? 'Sipariş yola çıktı olarak bildirildi.' : `Durum platforma iletilemedi: ${result.message}`,
    };
  }

  /**
   * Teslim Edildi
   */
  public async deliverOrder(orderId: string, platform?: OnlinePlatformCode): Promise<{ success: boolean; message: string }> {
    const result = await this.postToServer('deliver_online_order', { orderId, platform });
    this.updateLocalOrderStatus(orderId, 'TESLIM_EDILDI');
    return {
      success: result.ok,
      message: result.ok ? 'Teslimat platforma bildirildi.' : `Teslimat bilgisi platforma iletilemedi: ${result.message}`,
    };
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

  /**
   * Test siparişi enjekte eder
   */
}

export const onlinePlatformService = new OnlinePlatformService();
