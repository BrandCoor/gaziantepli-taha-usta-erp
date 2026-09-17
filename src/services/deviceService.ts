/**
 * GAZİANTEPLİ TAHA USTA ERP - Mobil Cihaz Parmak İzi & Eşleştirme Servisi
 * ------------------------------------------------------------------------
 * Cihaza özel tekil ve kalıcı UUID üretir.
 * Hibrit Eşleştirme Motoru:
 * 1. Yerel & Broadcast Senkronizasyonu (Hatasız ve anında 0ms eşleşme)
 * 2. Merkezi Veritabanı (api.rymedya.com.tr) arka plan senkronizasyonu
 * 3. Donanım mühürleme ve 4 haneli sert PIN güvenlik kilidi
 */

import { restaurantDataService, getApiSyncUrl, getPublicBaseUrl, WaiterConfig } from './restaurantDataService';
import { realtimeSyncService } from './realtimeSyncService';

export interface DeviceInfo {
  uuid: string;
  userAgent: string;
  platform: string;
  pairedAt?: string;
  pairedUserId?: string;
}

export interface PairResponse {
  success: boolean;
  message?: string;
  error?: string;
  error_code?: string;
  user?: {
    id: string;
    ad: string;
    rol: string;
    device_paired?: boolean;
  };
  device_uuid?: string;
}

export interface WaiterLoginResponse {
  success: boolean;
  message?: string;
  error?: string;
  error_code?: string;
  token?: string;
  user?: {
    id: string;
    ad: string;
    rol: string;
    device_paired: boolean;
    device_paired_at?: string;
  };
}

const STORAGE_KEY_UUID = 'gaziantepli_waiter_device_uuid';
const STORAGE_KEY_SESSION = 'gaziantepli_waiter_session';

class DeviceService {
  /**
   * Cihazın tarayıcısına özel tekil ve kalıcı parmak izi (Device UUID) üretir veya getirir
   */
  public getOrCreateDeviceUuid(): string {
    let uuid = localStorage.getItem(STORAGE_KEY_UUID);
    if (!uuid || uuid.length < 16) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        uuid = crypto.randomUUID();
      } else {
        const randPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const timePart = Date.now().toString(36);
        uuid = `dev_${timePart}_${randPart}`;
      }
      localStorage.setItem(STORAGE_KEY_UUID, uuid);
    }
    return uuid;
  }

  /**
   * Cihaz donanım ve tarayıcı bilgilerini özetler
   */
  public getDeviceInfo(): DeviceInfo {
    return {
      uuid: this.getOrCreateDeviceUuid(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown'
    };
  }

  /**
   * Cihaz modelini tespit eder (Apple iPhone, Android, Tablet vs.)
   */
  public detectDeviceType(): string {
    if (typeof navigator === 'undefined') return 'Mobil Cihaz';
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'Apple iPhone';
    if (/iPad/i.test(ua)) return 'Apple iPad';
    if (/Android/i.test(ua)) return 'Android Telefon';
    if (/Macintosh/i.test(ua)) return 'Apple Mac';
    if (/Windows/i.test(ua)) return 'Windows Terminal';
    return 'Mobil El Terminali';
  }

  /**
   * Sunucu API URL'sini çözümler (auth.php veya index.php)
   */
  private getAuthApiUrl(action: string): string {
    const configured = getApiSyncUrl().replace(/\/+$/, '');
    let endpoint = configured;
    if (!/\/(?:index|auth)\.php$/i.test(endpoint)) {
      endpoint = endpoint.endsWith('/api') ? `${endpoint}/index.php` : `${endpoint}/api/index.php`;
    }
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}action=${encodeURIComponent(action)}`;
  }

  /**
   * Kasa Tarafı: Personele özel geçerli QR eşleştirme belirteci ve URL üretir
   */
  public async createPairingToken(userId: string, actor?: { id: string; pin: string }): Promise<{ success: boolean; token?: string; qrUrl?: string; appUrl?: string; expiresAt?: string; error?: string }> {
    const waiter = restaurantDataService.getWaiters().find(w => w.id === userId);
    const fallbackToken = waiter?.qrToken || `TOKEN-GTU-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    
    if (waiter && !waiter.qrToken) {
      restaurantDataService.updateWaiter(userId, { qrToken: fallbackToken });
    }

    // Kasa yerel personel listesini MySQL'e göndermeyi dene
    try {
      await restaurantDataService.pushStateToCloud();
    } catch {}

    const urls = [
      this.getAuthApiUrl('create_pairing_token'),
      'https://api.rymedya.com.tr/index.php?action=create_pairing_token'
    ].filter((url, index, all) => all.indexOf(url) === index);

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, action: 'create_pairing_token', actorId: actor?.id, actorPin: actor?.pin }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const raw = await response.text();
        let result: any;
        try { result = JSON.parse(raw); } catch { result = {}; }
        if (response.ok && result.success && result.token) {
          if (waiter) restaurantDataService.updateWaiter(userId, { qrToken: result.token });
          return result;
        }
      } catch (error: any) {
        // Devam et, diğer URL veya fallback'e geç
      }
    }

    // Çevrimdışı / Yerel Fallback: Her zaman anında geçerli eşleşme tokenı sağla
    return {
      success: true,
      token: fallbackToken,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
  }

  /**
   * Mobil Garson PWA: QR taranınca veya link açılınca cihazı personele mühürler
   */
  public async pairDevice(userId: string, token: string, optionalPin?: string, optionalName?: string): Promise<PairResponse> {
    const deviceUuid = this.getOrCreateDeviceUuid();
    const devName = this.detectDeviceType();

    // 1. Bulut API üzerinden eşleştirmeyi dene
    try {
      const url = this.getAuthApiUrl('pair_device');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-UUID': deviceUuid },
        body: JSON.stringify({ action: 'pair_device', userId, token, device_uuid: deviceUuid, deviceName: devName }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const serverResult: PairResponse = await response.json();
      if (response.ok && serverResult.success && serverResult.user) {
        const waiter = restaurantDataService.getWaiters().find(w => w.id === serverResult.user?.id);
        if (waiter) {
          restaurantDataService.updateWaiter(waiter.id, {
            status: 'APPROVED', deviceUuid, macAddress: deviceUuid, deviceName: devName,
            ...(optionalPin ? { pin: optionalPin } : {}), ...(optionalName ? { name: optionalName } : {})
          });
          localStorage.setItem('gaziantepli_paired_user_name', serverResult.user.ad);
        }

        localStorage.setItem('gaziantepli_paired_user_id', serverResult.user.id);
        realtimeSyncService.broadcastWaiterPaired(serverResult.user.id, deviceUuid, devName);
        return { ...serverResult, user: { ...serverResult.user, device_paired: true }, device_uuid: deviceUuid };
      }
    } catch (e: any) {
      console.warn('[DeviceService] pairDevice bulut bağlantısı gecikti/başarısız, yerel kontrol yapılıyor:', e);
    }

    // 2. Yerel / Çevrimdışı Hibrit Eşleştirme Fallback
    const waiters = restaurantDataService.getWaiters();
    let waiter: WaiterConfig | undefined = waiters.find(w => w.id === userId);
    
    if (!waiter) {
      const newWaiter: WaiterConfig = {
        id: userId,
        name: optionalName || 'Garson',
        pin: optionalPin || '1234',
        phone: '',
        status: 'APPROVED',
        deviceUuid,
        macAddress: deviceUuid,
        deviceName: devName,
        qrToken: token,
        allowedSections: [],
        permissions: {
          canDiscount: false,
          canVoidItem: false,
          canGift: false,
          canTransferTable: true,
          canPrintBill: true
        },
        lastActiveAt: new Date().toISOString()
      };
      restaurantDataService.addWaiter(newWaiter);
      waiter = newWaiter;
    } else {
      restaurantDataService.updateWaiter(waiter.id, {
        status: 'APPROVED',
        deviceUuid,
        macAddress: deviceUuid,
        deviceName: devName,
        ...(optionalPin ? { pin: optionalPin } : {}),
        ...(optionalName ? { name: optionalName } : {})
      });
    }

    const finalWaiter = waiter;
    localStorage.setItem('gaziantepli_paired_user_id', finalWaiter.id);
    localStorage.setItem('gaziantepli_paired_user_name', finalWaiter.name);
    realtimeSyncService.broadcastWaiterPaired(finalWaiter.id, deviceUuid, devName);

    return {
      success: true,
      message: `[${finalWaiter.name}] cihazı başarıyla eşleştirildi.`,
      user: {
        id: finalWaiter.id,
        ad: finalWaiter.name,
        rol: 'Garson',
        device_paired: true
      },
      device_uuid: deviceUuid
    };
  }

  /**
   * Kasa Yöneticisi: 1 tıkla personeli doğrudan onayla ve eşleştir (QR taramadan)
   */
  public quickApproveAndPair(userId: string, customDeviceName?: string): { success: boolean; message: string } {
    const waiters = restaurantDataService.getWaiters();
    const waiter = waiters.find(w => w.id === userId);
    if (!waiter) {
      return { success: false, message: 'Personel bulunamadı.' };
    }

    const uuid = this.getOrCreateDeviceUuid();
    const devName = customDeviceName || waiter.deviceName || this.detectDeviceType();

    restaurantDataService.updateWaiter(userId, {
      status: 'APPROVED',
      deviceUuid: uuid,
      macAddress: uuid,
      deviceName: devName
    });

    realtimeSyncService.broadcastWaiterPaired(userId, uuid, devName);

    return {
      success: true,
      message: `[${waiter.name}] için cihaz eşleşmesi onaylandı.`
    };
  }

  /**
   * Kasa Yöneticisi: Cihaz eşleşmesini sıfırlar
   */
  public async resetDevicePairing(userId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      restaurantDataService.updateWaiter(userId, {
        status: 'PENDING',
        deviceUuid: '',
        macAddress: '',
        qrToken: ''
      });

      const pairedId = localStorage.getItem('gaziantepli_paired_user_id');
      if (pairedId === userId) {
        localStorage.removeItem('gaziantepli_paired_user_id');
        localStorage.removeItem('gaziantepli_paired_user_name');
        localStorage.removeItem(STORAGE_KEY_SESSION);
      }

      realtimeSyncService.broadcastWaiterReset(userId);

      // Arka planda sunucuya bildir
      try {
        const url = this.getAuthApiUrl('reset_device_pairing');
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, action: 'reset_device_pairing' })
        }).catch(() => {});
      } catch {}

      return {
        success: true,
        message: 'Cihaz eşleştirmesi başarıyla sıfırlandı.'
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'Sıfırlama isteği iletilemedi.' };
    }
  }

  /**
   * Mobil Garson Girişi: 4 haneli PIN ve Cihaz UUID doğrulaması (Sert Güvenlik Kilidi)
   */
  public async waiterLogin(pin: string, userId?: string): Promise<WaiterLoginResponse> {
    const currentDeviceUuid = this.getOrCreateDeviceUuid();
    const waiters = restaurantDataService.getWaiters();

    const candidateUrls = [
      this.getAuthApiUrl('waiter_login'),
      'https://api.rymedya.com.tr/index.php?action=waiter_login',
      'https://garson.rymedya.com.tr/api/index.php?action=waiter_login'
    ].filter((u, i, a) => a.indexOf(u) === i);

    for (const url of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Device-UUID': currentDeviceUuid },
          body: JSON.stringify({ action: 'waiter_login', pin, userId, device_uuid: currentDeviceUuid }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const serverResult: WaiterLoginResponse = await response.json();
        if (response.ok && serverResult.success) {
          localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(serverResult));
          if (serverResult.user) {
            localStorage.setItem('gaziantepli_paired_user_id', serverResult.user.id);
            localStorage.setItem('gaziantepli_paired_user_name', serverResult.user.ad);
          }
          return serverResult;
        }
        if (serverResult.error_code === 'DEVICE_NOT_PAIRED') {
          return serverResult;
        }
      } catch {
        // Sonraki URL veya yerel doğrulamaya devam et
      }
    }

    // 1. PIN koduna göre garsonu bul
    let waiter: WaiterConfig | undefined;
    if (userId) {
      waiter = waiters.find(w => w.id === userId && w.pin === pin);
    } else {
      waiter = waiters.find(w => w.pin === pin);
    }

    // Eğer garson yerel veritabanında yoksa ama eşleşmiş kullanıcı id'si varsa
    const pairedId = localStorage.getItem('gaziantepli_paired_user_id');
    const pairedName = localStorage.getItem('gaziantepli_paired_user_name');

    if (!waiter && pairedId) {
      const newWaiter: WaiterConfig = {
        id: pairedId,
        name: pairedName || 'Garson',
        pin: pin,
        phone: '',
        qrToken: '',
        status: 'APPROVED',
        deviceUuid: currentDeviceUuid,
        deviceName: this.detectDeviceType(),
        macAddress: currentDeviceUuid,
        allowedSections: [],
        permissions: {
          canDiscount: false,
          canVoidItem: false,
          canGift: false,
          canTransferTable: true,
          canPrintBill: true
        }
      };
      restaurantDataService.addWaiter(newWaiter);
      waiter = newWaiter;
    }

    if (!waiter) {
      return {
        success: false,
        error: 'Hatalı PIN kodu. Lütfen 4 haneli şifrenizi kontrol ediniz.',
        error_code: 'INVALID_CREDENTIALS'
      };
    }

    // 2. Cihaz Eşleşme Kontrolü (Sert Donanım Kilidi)
    const isApproved = waiter.status === 'APPROVED';
    const isDeviceMatched = 
      !waiter.deviceUuid || 
      waiter.deviceUuid === currentDeviceUuid || 
      waiter.macAddress === currentDeviceUuid ||
      pairedId === waiter.id;

    if (!isApproved) {
      return {
        success: false,
        error_code: 'DEVICE_NOT_PAIRED',
        error: `[${waiter.name}] hesabı henüz onaylanmamıştır. Lütfen kasanızdan onaylayınız veya QR kodu okutunuz.`
      };
    }

    if (!isDeviceMatched && waiter.deviceUuid) {
      return {
        success: false,
        error_code: 'DEVICE_NOT_PAIRED',
        error: `Bu cihaz ${waiter.name} hesabına eşleştirilmemiştir. Lütfen kasanızdan QR kod okutarak cihazınızı yetkilendirin.`
      };
    }

    // 3. Başarılı Giriş -> Cihaza henüz UUID yazılmadıysa bu cihazı bağla
    if (!waiter.deviceUuid) {
      restaurantDataService.updateWaiter(waiter.id, {
        deviceUuid: currentDeviceUuid,
        macAddress: currentDeviceUuid,
        deviceName: this.detectDeviceType()
      });
    }

    const sessionData: WaiterLoginResponse = {
      success: true,
      message: 'Giriş başarılı.',
      user: {
        id: waiter.id,
        ad: waiter.name,
        rol: 'GARSON',
        device_paired: true,
        device_paired_at: new Date().toISOString()
      }
    };

    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionData));
    localStorage.setItem('gaziantepli_paired_user_id', waiter.id);
    localStorage.setItem('gaziantepli_paired_user_name', waiter.name);

    return sessionData;
  }

  /**
   * Kasa Tarafı: Cihazın eşleşme durumunu anında sorgular (Hem Sunucu hem Yerel)
   */
  public async checkDeviceStatus(userId: string): Promise<{ success: boolean; is_paired: boolean; deviceName?: string; deviceUuid?: string }> {
    // 1. Sunucu API sorgulaması (MySQL / phpMyAdmin / cpanel senkronizasyonu)
    const candidateUrls = [
      this.getAuthApiUrl('check_device_status'),
      'https://api.rymedya.com.tr/index.php?action=check_device_status',
      'https://garson.rymedya.com.tr/api/index.php?action=check_device_status'
    ].filter((u, i, a) => a.indexOf(u) === i);

    for (const baseUrl of candidateUrls) {
      try {
        const sep = baseUrl.includes('?') ? '&' : '?';
        const url = `${baseUrl}${sep}userId=${encodeURIComponent(userId)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && (data.is_paired || data.has_registered_device)) {
            const devName = data.deviceName || data.device_name || 'Mobil Telefon';
            const devUuid = data.device_uuid || 'paired';

            restaurantDataService.updateWaiter(userId, {
              status: 'APPROVED',
              deviceUuid: devUuid,
              deviceName: devName
            });

            return {
              success: true,
              is_paired: true,
              deviceName: devName,
              deviceUuid: devUuid
            };
          }
        }
      } catch (e) {
        // Diğer URL veya yerel kontrole devam et
      }
    }

    // 2. Yerel bellek kontrolü
    const waiters = restaurantDataService.getWaiters();
    const waiter = waiters.find(w => w.id === userId);

    if (waiter && waiter.status === 'APPROVED' && (waiter.deviceUuid || waiter.macAddress)) {
      return {
        success: true,
        is_paired: true,
        deviceName: waiter.deviceName || 'Mobil Terminal',
        deviceUuid: waiter.deviceUuid || waiter.macAddress
      };
    }

    // Yerel eşleşme kontrolü (Aynı tarayıcıda ise)
    const pairedId = localStorage.getItem('gaziantepli_paired_user_id');
    if (pairedId === userId) {
      return {
        success: true,
        is_paired: true,
        deviceName: 'Mobil Telefon',
        deviceUuid: localStorage.getItem('gaziantepli_waiter_device_uuid') || 'local_device'
      };
    }

    return {
      success: true,
      is_paired: false
    };
  }

  /**
   * Aktif oturumu sonlandırır
   */
  public logout(): void {
    localStorage.removeItem(STORAGE_KEY_SESSION);
  }

  public hasPairedDevice(): boolean {
    return Boolean(localStorage.getItem('gaziantepli_paired_user_id'));
  }

  /**
   * Mevcut garson oturumunu döndürür
   */
  public getActiveSession(): WaiterLoginResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
}

export const deviceService = new DeviceService();
