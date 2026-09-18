/**
 * GAZİANTEPLİ TAHA USTA ERP - Mobil Cihaz Parmak İzi & Eşleştirme Servisi
 * ------------------------------------------------------------------------
 * Cihaza özel tekil ve kalıcı UUID üretir.
 * Hibrit Eşleştirme Motoru:
 * 1. Yerel & Broadcast Senkronizasyonu (Hatasız ve anında 0ms eşleşme)
 * 2. İşletmenin kendi sunucusundaki MySQL veritabanı ile senkronizasyon
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
    // Sunucu ayarlanmadıysa sabit bir alan adına düşmek yerine boş döndürülür:
    // aksi halde istekler yazılımcının sunucusuna gidiyordu.
    if (!configured) return '';
    let endpoint = configured;
    if (!/\/(?:index|auth)\.php$/i.test(endpoint)) {
      endpoint = endpoint.endsWith('/api') ? `${endpoint}/index.php` : `${endpoint}/api/index.php`;
    }
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}action=${encodeURIComponent(action)}`;
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
        if (!url) throw new Error('Senkronizasyon sunucusu ayarlanmadı.');
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
   * Mobil Garson Girisi: YALNIZCA 4 haneli PIN ile.
   *
   * PIN kodlari sistemde benzersizdir, bu yuzden garson dogrudan PIN'inden
   * taninir; QR okutma veya cihaz eslestirme sarti yoktur. Giris yapilan
   * telefon yalnizca kayit/denetim amaciyla saklanir.
   *
   * Sunucu bir yanit dondurduyse (401/409/429 dahil) o yanit esas alinir;
   * yerel dogrulama SADECE sunucuya hic ulasilamadiginda (internet yok,
   * zaman asimi) devreye girer.
   */
  public async waiterLogin(pin: string): Promise<WaiterLoginResponse> {
    const currentDeviceUuid = this.getOrCreateDeviceUuid();
    const cleanPin = String(pin || '').replace(/\D/g, '');

    if (!cleanPin) {
      return { success: false, error: 'Lütfen PIN kodunuzu girin.', error_code: 'INVALID_CREDENTIALS' };
    }

    const url = this.getAuthApiUrl('waiter_login');

    if (url) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Device-UUID': currentDeviceUuid },
          body: JSON.stringify({ action: 'waiter_login', pin: cleanPin, device_uuid: currentDeviceUuid }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const serverResult: WaiterLoginResponse = await response.json();

        if (response.ok && serverResult.success && serverResult.user) {
          localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(serverResult));
          localStorage.setItem('gaziantepli_paired_user_id', serverResult.user.id);
          localStorage.setItem('gaziantepli_paired_user_name', serverResult.user.ad);
          return serverResult;
        }

        // Sunucu bilincli olarak reddetti: yerel dogrulamaya DUSULMEZ,
        // aksi halde sunucudaki kilit/iptal kararlari atlanabilirdi.
        return {
          success: false,
          error: serverResult.error || serverResult.message || 'Giriş reddedildi.',
          error_code: serverResult.error_code || 'INVALID_CREDENTIALS'
        };
      } catch {
        // Sunucuya ulasilamadi: asagida yerel kayitlarla dogrulanir.
      }
    }

    // Sunucuya ulasilamadi -> kasanin yerel garson listesiyle dogrula.
    const matches = restaurantDataService.getWaiters().filter(
      w => String(w.pin || '').replace(/\D/g, '') === cleanPin
    );

    if (matches.length > 1) {
      return {
        success: false,
        error: 'Bu PIN birden fazla garsona tanımlı. Yöneticinizden PIN kodunuzu değiştirmesini isteyin.',
        error_code: 'DUPLICATE_PIN'
      };
    }

    const waiter = matches[0];
    if (!waiter) {
      return {
        success: false,
        error: url
          ? 'Hatalı PIN kodu. Lütfen 4 haneli şifrenizi kontrol ediniz.'
          : 'Sunucu adresi tanımlı değil ve bu PIN yerel kayıtlarda bulunamadı. Kasadan sunucu adresini ayarlayın.',
        error_code: 'INVALID_CREDENTIALS'
      };
    }

    // Giris yapan telefonu kaydet (eslestirme sarti degil, denetim kaydidir).
    restaurantDataService.updateWaiter(waiter.id, {
      status: 'APPROVED',
      deviceUuid: currentDeviceUuid,
      macAddress: currentDeviceUuid,
      deviceName: this.detectDeviceType()
    });

    const sessionData: WaiterLoginResponse = {
      success: true,
      message: 'Giriş başarılı (çevrimdışı doğrulama).',
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
   * Aktif oturumu sonlandırır
   */
  public logout(): void {
    localStorage.removeItem(STORAGE_KEY_SESSION);
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
