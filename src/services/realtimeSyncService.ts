/**
 * GAZİANTEPLİ TAHA USTA ERP - Gerçek Zamanlı Eşzamanlılık Servisi (Realtime Sync)
 * ---------------------------------------------------------------------------------
 * Kasa ekranı ve Garson el terminalleri arasındaki masaları, adisyon kalemlerini,
 * hesap isteklerini ve cihaz eşleştirmelerini 0 gecikme ile eşzamanlar.
 * 
 * Mimari:
 * 1. BroadcastChannel API: Aynı tarayıcı ve sekmeler arası anlık senkronizasyon (0ms).
 * 2. Storage Event Listener: Çoklu pencere ve localStorage değişim tetikleyicisi.
 * 3. CustomEvent: Aynı pencere içi bileşenler arası reaktif veri akışı.
 */

import { TableState } from './restaurantDataService';

export type RealtimeEventType = 
  | 'TABLES_UPDATED'
  | 'ORDER_SUBMITTED'
  | 'BILL_REQUESTED'
  | 'TABLE_TRANSFERRED'
  | 'WAITER_PAIRED'
  | 'WAITER_RESET';

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: any;
  source: 'KASA' | 'WAITER' | 'SYSTEM';
  timestamp: number;
  senderId: string;
}

type EventListener = (event: RealtimeEvent) => void;

class RealtimeSyncService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<EventListener> = new Set();
  private clientId: string;

  constructor() {
    this.clientId = 'client_' + Math.random().toString(36).substring(2, 9);

    if (typeof window !== 'undefined') {
      // 1. BroadcastChannel desteği
      if ('BroadcastChannel' in window) {
        try {
          this.channel = new BroadcastChannel('gtu_erp_realtime_sync');
          this.channel.onmessage = (event: MessageEvent<RealtimeEvent>) => {
            if (event.data && event.data.senderId !== this.clientId) {
              this.dispatchToListeners(event.data);
            }
          };
        } catch (e) {
          console.warn('[RealtimeSync] BroadcastChannel başlatılamadı, fallback devrede:', e);
        }
      }

      // 2. Storage Event fallback (Çapraz sekme senkronizasyonu)
      window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === 'gtu_realtime_broadcast_event' && e.newValue) {
          try {
            const data: RealtimeEvent = JSON.parse(e.newValue);
            if (data && data.senderId !== this.clientId) {
              this.dispatchToListeners(data);
            }
          } catch {}
        }
      });

      // 3. CustomEvent dinleyicisi (Tekil sekme içi modüller)
      window.addEventListener('gtu:realtime_sync', (e: any) => {
        if (e.detail && e.detail.senderId !== this.clientId) {
          this.dispatchToListeners(e.detail);
        }
      });
    }
  }

  private dispatchToListeners(event: RealtimeEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[RealtimeSync] Dinleyici hatası:', err);
      }
    });
  }

  /**
   * Bir olayı tüm açık sekmelere ve yerel dinleyicilere yayınlar
   */
  public broadcast(type: RealtimeEventType, payload: any, source: 'KASA' | 'WAITER' | 'SYSTEM' = 'SYSTEM') {
    const event: RealtimeEvent = {
      type,
      payload,
      source,
      timestamp: Date.now(),
      senderId: this.clientId
    };

    // 1. BroadcastChannel üzerinden ilet
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch (e) {
        console.warn('[RealtimeSync] BroadcastChannel postMessage hatası:', e);
      }
    }

    // 2. localStorage üzerinden ilet (StorageEvent tetikler)
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('gtu_realtime_broadcast_event', JSON.stringify(event));
      } catch {}
    }

    // 3. CustomEvent ile pencere içine ilet
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('gtu:realtime_sync', { detail: event }));
      } catch {}
    }
  }

  /**
   * Masa durumları güncellendiğinde tüm sisteme yayınlar
   */
  public broadcastTablesUpdated(tables: TableState[], source: 'KASA' | 'WAITER' = 'KASA') {
    this.broadcast('TABLES_UPDATED', { tables }, source);
  }

  /**
   * Garson sipariş girdiğinde anında yayınlar
   */
  public broadcastOrderSubmitted(orderPayload: any, source: 'WAITER' | 'KASA' = 'WAITER') {
    this.broadcast('ORDER_SUBMITTED', orderPayload, source);
  }

  /**
   * Garson hesap istediğinde yayınlar
   */
  public broadcastBillRequested(tableId: string, tableName: string, waiterName: string) {
    this.broadcast('BILL_REQUESTED', { tableId, tableName, waiterName }, 'WAITER');
  }

  /**
   * Masa transfer edildiğinde yayınlar
   */
  public broadcastTableTransferred(sourceTableId: string, targetTableId: string) {
    this.broadcast('TABLE_TRANSFERRED', { sourceTableId, targetTableId }, 'SYSTEM');
  }

  /**
   * Cihaz eşleştirildiğinde yayınlar
   */
  public broadcastWaiterPaired(waiterId: string, deviceUuid: string, deviceName: string) {
    this.broadcast('WAITER_PAIRED', { waiterId, deviceUuid, deviceName }, 'SYSTEM');
  }

  /**
   * Cihaz eşleştirmesi sıfırlandığında yayınlar
   */
  public broadcastWaiterReset(waiterId: string) {
    this.broadcast('WAITER_RESET', { waiterId }, 'SYSTEM');
  }

  /**
   * Gerçek zamanlı olayları dinle
   */
  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const realtimeSyncService = new RealtimeSyncService();
