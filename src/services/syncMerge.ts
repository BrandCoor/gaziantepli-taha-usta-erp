/**
 * Bulut → kasa veri birleştirme kuralları.
 *
 * Eski davranış: bulut listesi doluysa yerel veri tamamen EZİLİYORDU (açık masalar, Z raporları,
 * tamamlanmış adisyonlar dahil). Bulut eski/eksikse son satışlar kaybolabilirdi.
 *
 * Yeni kural:
 *  - Geçmiş kayıtları (Z, adisyon arşivi, cari/toptancı hareketleri, giderler): ID bazlı BİRLEŞİM.
 *    Yerel kayıt her zaman korunur; yalnızca yerelde olmayan bulut kayıtları eklenir.
 *  - Ana veri (ürün, kategori, personel, yazıcı, müşteri, toptancı, bölüm): bulut yalnızca yerel LİSTE BOŞSA
 *    uygulanır (ilk kurulum / yeni bilgisayara geri yükleme). Kasa asıl kaynaktır.
 *  - Masalar (açık adisyonlar): yalnızca yerelde hiç masa yoksa bulutan alınır.
 */
export interface WithId {
  id: string;
}

/** Yerel kayıtlar önce, ardından yerelde bulunmayan uzak kayıtlar. Yerel hiçbir kaydı kaybetmez. */
export function mergeById<T extends WithId>(local: T[], remote: T[]): T[] {
  const seen = new Set(local.map((x) => x.id));
  const out = [...local];
  for (const r of remote || []) {
    if (r && r.id !== undefined && !seen.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
}

/** Ana veri için: yerel boşsa uzak liste, doluysa yerel liste. */
export function fillIfEmpty<T>(local: T[], remote: T[]): T[] {
  return local && local.length > 0 ? local : remote || [];
}

export function safeParseArray(raw: string | null): any[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
