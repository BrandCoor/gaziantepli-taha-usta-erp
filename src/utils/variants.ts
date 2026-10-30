/**
 * Ürün seçenekleri (varyantlar): aynı ürünün farklı boyut/porsiyonlarının AYRI SABİT fiyatları.
 * Örn. Adana Kebap → "1 Porsiyon" 280 ₺, "1,5 Porsiyon" 400 ₺; Ayran → "330 ml" 25 ₺, "1 Litre" 60 ₺.
 *
 * Kurallar
 *  - Seçeneği olan üründe satış, bir seçenek seçilmeden yapılamaz.
 *  - Ürünün `price` alanı = en düşük seçenek fiyatıdır ("280 ₺'den" gösterimi, sıralama, geriye uyumluluk).
 *  - Siparişte kalem adı "Ürün (Seçenek)" olur: fiş, rapor ve mutfak bunu olduğu gibi kullanır;
 *    farklı boyutlar raporda ayrı satır olarak görünür.
 *  - Garson/QR menü fiyatı sunucu belirler (sunucu seçenek kimliğinden fiyatı yeniden okur).
 */
export interface ProductVariant {
  id: string;
  name: string;
  price: number;
}

export const MAX_VARIANTS = 12;

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Geçersiz/boş satırları ayıklar, fiyatları kuruşa yuvarlar. Kimliği olmayana kimlik verir. */
export function sanitizeVariants(input: unknown, genId: () => string = () => 'v-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)): ProductVariant[] {
  if (!Array.isArray(input)) return [];
  const out: ProductVariant[] = [];
  const usedIds = new Set<string>();
  for (const raw of input as any[]) {
    const name = String(raw?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const price = round2(Number(raw?.price));
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    let id = String(raw?.id || '').trim() || genId();
    while (usedIds.has(id)) id = genId();
    usedIds.add(id);
    out.push({ id, name, price });
  }
  return out.slice(0, MAX_VARIANTS);
}

/** Kaydetmeden önce kullanıcıya gösterilecek hata (yoksa null). Boş ad/fiyat sessizce atılmaz, uyarılır. */
export function validateVariantRows(rows: Array<{ name?: unknown; price?: unknown }>): string | null {
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const name = String(rows[i].name ?? '').replace(/\s+/g, ' ').trim();
    const price = Number(rows[i].price);
    const blank = !name && (!rows[i].price || price === 0);
    if (blank) continue; // tamamen boş satır yok sayılır
    if (!name) return `${i + 1}. seçeneğin adı boş.`;
    if (!Number.isFinite(price) || price <= 0) return `"${name}" için geçerli bir fiyat girin.`;
    const key = name.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) return `"${name}" adı birden fazla seçenekte kullanılmış.`;
    seen.add(key);
  }
  if (rows.filter((r) => String(r.name ?? '').trim()).length > MAX_VARIANTS) return `En fazla ${MAX_VARIANTS} seçenek tanımlanabilir.`;
  return null;
}

export const hasVariants = (p: { variants?: ProductVariant[] } | null | undefined): boolean => !!p && Array.isArray(p.variants) && p.variants.length > 0;

/** Ürünün temel fiyatı: seçenek varsa en düşük seçenek fiyatı. */
export function basePrice(variants: ProductVariant[] | undefined, fallback: number): number {
  return variants && variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : Number(fallback) || 0;
}

export function findVariant(p: { variants?: ProductVariant[] }, id: string | undefined | null): ProductVariant | undefined {
  return id ? (p.variants || []).find((v) => v.id === id) : undefined;
}

/** Sipariş kalemi adı: "Ayran (1 Litre)". */
export const variantLineName = (productName: string, variantName: string): string => `${productName} (${variantName})`;

/** Menüde gösterim: tek fiyat ya da "25 ₺'den" / aralık. */
export function priceLabel(p: { price: number; variants?: ProductVariant[] }, fmt: (n: number) => string = (n) => String(n)): string {
  if (!hasVariants(p)) return fmt(p.price);
  const prices = p.variants!.map((v) => v.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
}

/** Sık kullanılan hazır seçenek adları (tek tıkla eklenir). */
export const VARIANT_PRESETS = ['1 Porsiyon', '1,5 Porsiyon', '2 Porsiyon', 'Yarım Porsiyon', 'Küçük', 'Orta', 'Büyük', '330 ml', '500 ml', '1 Litre'];
