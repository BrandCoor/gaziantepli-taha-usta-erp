/**
 * GCallerID 2Hat (Gentema) Frontend Servisi
 * ----------------------------------------
 * - Hat 1 ve Hat 2 gelen çağrılarını WebSocket ve Electron IPC üzerinden yakalar.
 * - phpMyAdmin / MySQL 'customers' ve 'calls_history' ile anlık senkronize olur.
 * - Eşzamanlı çift hat desteği: Hat 1 ve Hat 2 aynı anda çaldığında hiçbir çağrıyı düşürmez.
 */

import { dataService, Customer } from './dataService';
import { getApiSyncUrl } from './restaurantDataService';

export interface ActiveCall {
  id: string;
  line: 1 | 2;
  phone: string;
  timestamp: string;
  customer: {
    id?: string;
    name: string;
    phone: string;
    address?: string;
    directions?: string;
    balance?: number;
    notes?: string;
  } | null;
  recentOrders: Array<{
    id: string;
    tableName?: string;
    totalAmount: number;
    createdAt: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      notes?: string;
    }>;
  }>;
  status: 'RINGING' | 'ANSWERED' | 'DISMISSED' | 'ORDER_STARTED';
}

type CallerIdListener = (activeCalls: ActiveCall[]) => void;

class CallerIdService {
  private activeCalls: ActiveCall[] = [];
  private listeners: Set<CallerIdListener> = new Set();
  private ws: WebSocket | null = null;
  private wsReconnectTimer: any = null;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.initWebSocket();
    this.initElectronListener();
  }

  public subscribe(listener: CallerIdListener): () => void {
    this.listeners.add(listener);
    listener([...this.activeCalls]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const list = [...this.activeCalls];
    this.listeners.forEach(fn => fn(list));
  }

  public getActiveCalls(): ActiveCall[] {
    return [...this.activeCalls];
  }

  /**
   * Web Audio API ile telefon zili / bildirim tonu çalar
   */
  public playRingtone() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      if (!this.audioContext) return;

      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(480, now + 0.15);
      osc.frequency.setValueAtTime(440, now + 0.3);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {
      console.warn('Zil sesi çalınamadı:', e);
    }
  }

  /**
   * Yerel Express WebSocket sunucusuna bağlanır (Port 4545)
   */
  private initWebSocket() {
    if (typeof window === 'undefined') return;

    const host = window.location.hostname || '127.0.0.1';
    const wsUrl = `ws://${host}:4545`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ [CallerID] Yerel WebSocket bağlandı:', wsUrl);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'CALLER_ID' && data.event) {
            this.handleIncomingCall(data.event.line, data.event.phone);
          }
        } catch (e) {
          console.error('WebSocket veri hatası:', e);
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.wsReconnectTimer) {
          this.wsReconnectTimer = setTimeout(() => {
            this.wsReconnectTimer = null;
            this.initWebSocket();
          }, 3000);
        }
      };

      this.ws.onerror = () => {
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (e) {
      // Sessizce yeniden dene
    }
  }

  /**
   * Electron IPC desteği
   */
  private initElectronListener() {
    if (typeof window !== 'undefined' && (window as any).electron?.on) {
      (window as any).electron.on('callerid-incoming', (_: any, data: { line: 1 | 2; phone: string }) => {
        if (data && data.phone) {
          this.handleIncomingCall(data.line || 1, data.phone);
        }
      });
    }
  }

  /**
   * Çağrıyı yakalar, phpMyAdmin / yerel müşteride arar ve bildirim kuyruğuna ekler
   */
  public async handleIncomingCall(line: 1 | 2, rawPhone: string) {
    const clean = rawPhone.replace(/\D/g, '');
    const formattedPhone = clean.startsWith('90') && clean.length === 12 
      ? '0' + clean.slice(2) 
      : clean.length === 10 && !clean.startsWith('0') 
        ? '0' + clean 
        : rawPhone.trim();

    console.log(`🔔 [GCallerID] HAT ${line} Çalıyor: ${formattedPhone}`);
    this.playRingtone();

    // 1. Yerel veritabanında müşteriyi hızlıca kontrol et
    const localCustomers: Customer[] = dataService.getCustomers() || [];
    const searchSuffix = clean.slice(-7);
    const localCust = localCustomers.find(c => {
      const cClean = (c.phone || '').replace(/\D/g, '');
      return cClean.endsWith(searchSuffix) || searchSuffix.endsWith(cClean.slice(-7));
    });

    let customerInfo: any = localCust ? {
      id: localCust.id,
      name: localCust.name,
      phone: localCust.phone || formattedPhone,
      address: localCust.address || '',
      directions: (localCust as any).directions || '',
      balance: localCust.balance || 0,
      notes: localCust.notes || ''
    } : null;

    let recentOrders: any[] = [];

    // 2. cPanel phpMyAdmin API üzerinden kontrol ve kayıt
    try {
      const apiUrl = getApiSyncUrl();
      const res = await fetch(`${apiUrl}?action=record_call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hat_no: line,
          telefon: formattedPhone,
          durum: 'CEVAPLANDI'
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.customer) {
          customerInfo = {
            id: json.customer.id,
            name: json.customer.ad_soyad || json.customer.ad || customerInfo?.name || 'Müşteri',
            phone: json.customer.telefon || formattedPhone,
            address: json.customer.adres || customerInfo?.address || '',
            directions: json.customer.adres_tarifi || customerInfo?.directions || '',
            balance: Number(json.customer.cari_bakiye || json.customer.bakiye || 0),
            notes: json.customer.notlar || customerInfo?.notes || ''
          };
        }
        if (json.recentOrders && Array.isArray(json.recentOrders)) {
          recentOrders = json.recentOrders;
        }
      }
    } catch (err) {
      console.warn('Bulut API çağrı kaydı yapılamadı (Çevrimdışı/Yerel Mod):', err);
    }

    // Çağrı ID oluştur
    const callId = `call_${Date.now()}_${line}_${Math.random().toString(36).substr(2, 3)}`;

    // Aynı hat ve numara için çalan çağrı zaten varsa güncelle, yoksa ekle
    const existingIndex = this.activeCalls.findIndex(c => c.line === line && c.phone === formattedPhone && c.status === 'RINGING');
    if (existingIndex >= 0) {
      this.activeCalls[existingIndex].timestamp = new Date().toISOString();
      this.activeCalls[existingIndex].customer = customerInfo;
      this.activeCalls[existingIndex].recentOrders = recentOrders;
    } else {
      this.activeCalls.unshift({
        id: callId,
        line,
        phone: formattedPhone,
        timestamp: new Date().toISOString(),
        customer: customerInfo,
        recentOrders,
        status: 'RINGING'
      });
    }

    this.notify();
  }

  /**
   * Çağrıyı ekrandan kapatır
   */
  public dismissCall(callId: string) {
    this.activeCalls = this.activeCalls.filter(c => c.id !== callId);
    this.notify();
  }

  /**
   * Çağrı durumunu siparişe dönüştü olarak işaretler ve modalı kapatır
   */
  public completeCall(callId: string) {
    const call = this.activeCalls.find(c => c.id === callId);
    if (call) {
      call.status = 'ORDER_STARTED';
      // Buluta siparişe dönüştüğünü bildir
      const apiUrl = getApiSyncUrl();
      fetch(`${apiUrl}?action=update_call_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, durum: 'SIPARISE_DONUSTU' })
      }).catch(() => {});
    }
    this.dismissCall(callId);
  }

  /**
   * Test amacıyla Hat 1 veya Hat 2 çağrısı simüle eder
   */
  public simulateCall(line: 1 | 2 = 1, phone: string = '05321234567') {
    this.handleIncomingCall(line, phone);
  }

  /**
   * Donanım COM portlarını sorgular
   */
  public async getAvailablePorts(): Promise<any[]> {
    try {
      const res = await fetch('http://127.0.0.1:4545/api/callerid/ports');
      if (res.ok) {
        const json = await res.json();
        return json.ports || [];
      }
    } catch (e) {}
    return [];
  }

  /**
   * Donanım COM portuna bağlanır
   */
  public async connectPort(port: string): Promise<any> {
    try {
      const res = await fetch('http://127.0.0.1:4545/api/callerid/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Donanım durumunu sorgular
   */
  public async getStatus(): Promise<any> {
    try {
      const res = await fetch('http://127.0.0.1:4545/api/callerid/status');
      if (res.ok) return await res.json();
    } catch (e) {}
    return { connected: false, portName: 'Bilinmiyor' };
  }
}

export const callerIdService = new CallerIdService();
