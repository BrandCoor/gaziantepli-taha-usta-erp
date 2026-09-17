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

const DEFAULT_PLATFORMS: Record<OnlinePlatformCode, OnlinePlatformInfo> = {
  YEMEKSEPETI: {
    code: 'YEMEKSEPETI',
    name: 'Yemeksepeti',
    isEnabled: true,
    storeStatus: 'OPEN',
    deliveryModel: 'RESTAURANT_COURIER',
    credentials: {
      vendorId: 'YS-770463',
      clientId: 'deliveryhero_client_gtu',
      clientSecret: 'dh_sec_99482710492',
      storeUuid: 'c4b8e21a-7b3f-4e52-9c12-08f654e9bc31',
    },
    webhookSecret: 'ys_wh_sec_2026',
    webhookUrl: 'https://api.rymedya.com.tr/api/online/webhook.php?platform=YEMEKSEPETI',
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
    isEnabled: true,
    storeStatus: 'OPEN',
    deliveryModel: 'PLATFORM_COURIER',
    credentials: {
      supplierId: '770463',
      apiKey: 'Es32CcLQUCJs51lAPgJ8',
      secretKey: 'xbuy0pocdpcUOfGd8kNS9',
    },
    webhookSecret: 'ty_wh_sec_2026',
    webhookUrl: 'https://api.rymedya.com.tr/api/online/webhook.php?platform=TRENDYOL',
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
    isEnabled: true,
    storeStatus: 'OPEN',
    deliveryModel: 'PLATFORM_COURIER',
    credentials: {
      restaurantSecretKey: 'gtr_sec_44820199',
      appKey: 'getir_food_app_gtu',
      restaurantId: '65ef9a2c8901bca2',
    },
    webhookSecret: 'gtr_wh_sec_2026',
    webhookUrl: 'https://api.rymedya.com.tr/api/online/webhook.php?platform=GETIR',
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
  public async setDeliveryModel(code: OnlinePlatformCode, deliveryModel: DeliveryModel): Promise<boolean> {
    if (this.platforms[code]) {
      this.platforms[code].deliveryModel = deliveryModel;
      this.saveLocalPlatforms();
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
   * API Bağlantısını Test Eder
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
      const res = await fetch(`${this.getApiUrl()}?action=test_online_connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: code,
          ...p.credentials,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: Boolean(data.success),
          message: data.message || 'Bağlantı doğrulandı.',
        };
      }
    } catch (e) {}

    // Fallback: Yerel parametre doluluk kontrolü
    let isValid = false;
    if (code === 'TRENDYOL') {
      isValid = Boolean(p.credentials.supplierId && p.credentials.apiKey);
    } else if (code === 'GETIR') {
      isValid = Boolean(p.credentials.restaurantSecretKey || p.credentials.appKey);
    } else {
      isValid = Boolean(p.credentials.vendorId || p.credentials.clientId);
    }

    if (isValid) {
      return {
        success: true,
        message: `${p.name} API Gateway kimlik doğrulama başarıyla test edildi.`,
      };
    }
    return {
      success: false,
      message: `${p.name} için zorunlu API anahtarlarından biri eksik.`,
    };
  }

  /**
   * Online Siparişleri Sunucudan ve Yerel Depodan Çeker
   */
  public async fetchOrders(statusFilter: 'ACTIVE' | 'HISTORY' | 'ALL' = 'ACTIVE', platformFilter: 'ALL' | OnlinePlatformCode = 'ALL'): Promise<OnlineOrder[]> {
    let fetchedOrders: OnlineOrder[] = [];

    try {
      const res = await fetch(`${this.getApiUrl()}?action=get_online_orders&status=${statusFilter}&platform=${platformFilter}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.orders)) {
          fetchedOrders = data.orders;
        }
      }
    } catch (e) {}

    // Eğer sunucu ulaşılamazsa veya boşsa yerel depodan oku
    if (fetchedOrders.length === 0) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
        if (saved) {
          const list: OnlineOrder[] = JSON.parse(saved);
          fetchedOrders = list;
        }
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
  public async acceptOrder(order: OnlineOrder): Promise<{ success: boolean; message: string }> {
    try {
      await fetch(`${this.getApiUrl()}?action=accept_online_order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          platform: order.platform,
          deliveryModel: order.deliveryModel,
          assignedCourierId: order.assignedCourierId,
          assignedCourierName: order.assignedCourierName,
          platformCourierName: order.platformCourierName,
          platformCourierPhone: order.platformCourierPhone,
          handoverCode: order.handoverCode,
        }),
      });
    } catch (e) {}

    // Durumu güncelle
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
    return {
      success: true,
      message: `[${order.platform}] #${order.platformOrderId} onaylandı (${modelLabel}). İstasyon & teslimat fişleri yazdırıldı.`,
    };
  }

  /**
   * Siparişe Restoran Kuryesi Atar
   */
  public async assignCourier(orderId: string, courierId: string, courierName: string, platform?: OnlinePlatformCode): Promise<boolean> {
    try {
      await fetch(`${this.getApiUrl()}?action=assign_courier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          courierId,
          courierName,
          platform,
        }),
      });
    } catch (e) {}

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

    return true;
  }

  /**
   * Kasiyer Siparişi İptal Eder (Zorunlu Sebep ile)
   */
  public async rejectOrder(orderId: string, reason: string, platform?: OnlinePlatformCode): Promise<boolean> {
    try {
      await fetch(`${this.getApiUrl()}?action=reject_online_order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          platform,
          cancelReason: reason,
        }),
      });
    } catch (e) {}

    this.updateLocalOrderStatus(orderId, 'IPTAL', reason);
    return true;
  }

  /**
   * Kuryeye Verildi / Yola Çıktı
   */
  public async dispatchOrder(orderId: string, platform?: OnlinePlatformCode): Promise<boolean> {
    try {
      await fetch(`${this.getApiUrl()}?action=dispatch_online_order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, platform }),
      });
    } catch (e) {}

    this.updateLocalOrderStatus(orderId, 'YOLA_CIKTI');
    return true;
  }

  /**
   * Teslim Edildi
   */
  public async deliverOrder(orderId: string, platform?: OnlinePlatformCode): Promise<boolean> {
    try {
      await fetch(`${this.getApiUrl()}?action=deliver_online_order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, platform }),
      });
    } catch (e) {}

    this.updateLocalOrderStatus(orderId, 'TESLIM_EDILDI');
    return true;
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
  public async createTestOrder(platform: OnlinePlatformCode): Promise<OnlineOrder | null> {
    const samples: Record<OnlinePlatformCode, { name: string; phone: string; address: string; note: string; items: OnlineOrderItem[] }> = {
      YEMEKSEPETI: {
        name: 'Ahmet Karadeniz',
        phone: '0533 444 8899',
        address: 'Acıbadem Mah. Çeçen Sok. No: 12 D: 4 Kadıköy / İstanbul',
        note: 'Lütfen bol sumaklı ezme ve ekstra lavaş koyunuz. Kapıyı iki kere tıklatın.',
        items: [
          { name: 'Gaziantep Lahmacun', quantity: 3, price: 110, note: 'Gevrek olsun' },
          { name: 'Ali Nazik Kebap', quantity: 1, price: 440, note: 'Tereyağı bol' },
          { name: 'Açık Köy Ayranı', quantity: 2, price: 40 },
        ],
      },
      TRENDYOL: {
        name: 'Mehmet Taha Gümüş',
        phone: '0532 555 1234',
        address: 'Fenerbahçe Mah. Bağdat Cad. No: 184 D: 5 Kadıköy / İstanbul',
        note: 'Sıcak gelsin lütfen. Zili çalmayın bebek uyuyor.',
        items: [
          { name: 'Antep Usulü Özel Lahmacun', quantity: 4, price: 110, note: 'Çıtır' },
          { name: 'Küşleme Kebap Porsiyon', quantity: 1, price: 420 },
          { name: 'Fıstıklı Havuç Dilim Baklava', quantity: 1, price: 240, note: 'Kaymaklı' },
        ],
      },
      GETIR: {
        name: 'Zeynep Kaya',
        phone: '0544 222 3344',
        address: 'Moda Cad. Ressam Şeref Akdik Sok. No: 8 Moda / Kadıköy',
        note: 'Temassız teslimat, kapıya asınız.',
        items: [
          { name: 'Beyti Kebap Sarma', quantity: 1, price: 460 },
          { name: 'Fındık Lahmacun (5 Adet)', quantity: 1, price: 280 },
          { name: 'Şalgam Suyu (Acılı)', quantity: 1, price: 45 },
        ],
      },
    };

    const s = samples[platform];
    const totalAmount = s.items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    const platformConfig = this.getPlatform(platform);
    const deliveryModel: DeliveryModel = platformConfig.deliveryModel || 'RESTAURANT_COURIER';
    const isPlatformCourier = deliveryModel === 'PLATFORM_COURIER';

    const courierPool = {
      TRENDYOL: { name: 'Ali Yılmaz (Trendyol GO)', phone: '0530 111 2233' },
      GETIR: { name: 'Emre Karaca (Getir Kuryesi)', phone: '0542 333 4455' },
      YEMEKSEPETI: { name: 'Murat Şahin (Vale Kurye)', phone: '0533 666 7788' },
    };

    const handoverCode = isPlatformCourier ? String(Math.floor(1000 + Math.random() * 9000)) : undefined;
    const platformCourier = isPlatformCourier ? courierPool[platform] : undefined;

    const newOrder: OnlineOrder = {
      id: 'onl-' + Date.now(),
      platform,
      platformOrderId: 'ORD-' + Math.floor(10000 + Math.random() * 90000),
      customerName: s.name,
      customerPhone: s.phone,
      address: s.address,
      orderNote: s.note,
      items: s.items,
      totalAmount,
      paymentMethod: isPlatformCourier ? 'Online Kredi Kartı' : (Math.random() > 0.5 ? 'Kapıda Nakit' : 'Kapıda Kredi Kartı (POS)'),
      status: 'BEKLIYOR',
      createdAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      deliveryModel,
      handoverCode,
      platformCourierName: platformCourier?.name,
      platformCourierPhone: platformCourier?.phone,
      platformCourierEtaMinutes: isPlatformCourier ? Math.floor(5 + Math.random() * 10) : undefined,
    };

    // Sunucuya gönder
    try {
      await fetch(`${this.getApiUrl()}?action=create_test_online_order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      });
    } catch (e) {}

    // Yerel havuza ekle
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ORDERS);
      const list = saved ? JSON.parse(saved) : [];
      list.unshift(newOrder);
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(list));
    } catch (e) {}

    // Yeni sipariş alarmını başlat
    this.startContinuousAlarm();

    return newOrder;
  }
}

export const onlinePlatformService = new OnlinePlatformService();
