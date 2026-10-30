/**
 * Gelen (garson/bulut) siparişleri için KALICI tekrar engelleme.
 * Önceki sürüm yalnızca bellekteki bir Set kullanıyordu; uygulama yeniden başlayınca sıfırlanıyordu.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROCESSED_INCOMING_KEY = 'gtu_processed_incoming_ids';

/** Sunucu ve istemci aynı kimliği üretir: clientOrderId varsa 'ord-<clientOrderId>'. */
export function normalizeIncomingId(incoming: any): string {
  if (!incoming) return '';
  const client = typeof incoming.clientOrderId === 'string' ? incoming.clientOrderId.replace(/[^A-Za-z0-9_-]/g, '') : '';
  if (client.length >= 8 && client.length <= 48) return `ord-${client}`;
  if (incoming.id) return String(incoming.id);
  if (incoming.orderId) return String(incoming.orderId);
  return `${incoming.tableId}-${incoming.totalAmount || ''}-${incoming.items?.length || 0}-${incoming.timestamp || ''}`;
}

export class ProcessedIdStore {
  private ids: string[] = [];
  private set = new Set<string>();

  constructor(private storage: KeyValueStorage, private key = PROCESSED_INCOMING_KEY, private max = 2000) {
    try {
      const raw = storage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        this.ids = parsed.filter((x) => typeof x === 'string').slice(-max);
        this.set = new Set(this.ids);
      }
    } catch {
      this.ids = [];
      this.set = new Set();
    }
  }

  has(id: string): boolean {
    return this.set.has(id);
  }

  add(id: string): void {
    if (!id || this.set.has(id)) return;
    this.ids.push(id);
    this.set.add(id);
    while (this.ids.length > this.max) {
      const old = this.ids.shift()!;
      this.set.delete(old);
    }
    this.storage.setItem(this.key, JSON.stringify(this.ids));
  }
}
