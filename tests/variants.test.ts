import { describe, it, expect } from 'vitest';
import { sanitizeVariants, validateVariantRows, basePrice, priceLabel, variantLineName, hasVariants, findVariant, MAX_VARIANTS } from '../src/utils/variants';
import { freshServices } from './helpers/browserStub';
import { buildTicketDoc } from '../electron/receiptBuilder';

describe('ürün seçenekleri (boyut/porsiyon)', () => {
  it('geçersiz satırlar atılır, fiyat kuruşa yuvarlanır, kimlik üretilir ve benzersiz kalır', () => {
    let n = 0;
    const out = sanitizeVariants([
      { name: ' 1  Porsiyon ', price: '280' },
      { name: '', price: 10 },
      { name: 'Bedava', price: 0 },
      { name: 'Eksi', price: -5 },
      { name: '1,5 Porsiyon', price: 400.456, id: 'x' },
      { name: 'Aynı kimlik', price: 5, id: 'x' },
    ], () => 'g' + ++n);
    expect(out.map((v) => v.name)).toEqual(['1 Porsiyon', '1,5 Porsiyon', 'Aynı kimlik']);
    expect(out[1].price).toBe(400.46);
    expect(new Set(out.map((v) => v.id)).size).toBe(3);
    expect(sanitizeVariants(undefined)).toEqual([]);
    expect(sanitizeVariants(Array.from({ length: 30 }, (_, i) => ({ name: 'S' + i, price: 1 }))).length).toBe(MAX_VARIANTS);
  });

  it('kaydetme öncesi doğrulama kullanıcıya anlaşılır hata verir', () => {
    expect(validateVariantRows([{ name: '330 ml', price: 25 }, { name: '1 Litre', price: 60 }])).toBeNull();
    expect(validateVariantRows([{ name: '', price: '' }])).toBeNull(); // tamamen boş satır yok sayılır
    expect(validateVariantRows([{ name: '', price: 20 }])).toMatch(/adı boş/);
    expect(validateVariantRows([{ name: 'Büyük', price: 0 }])).toMatch(/fiyat/);
    expect(validateVariantRows([{ name: 'Büyük', price: 5 }, { name: 'BÜYÜK', price: 6 }])).toMatch(/birden fazla/);
    expect(validateVariantRows([{ name: 'ıı', price: 5 }, { name: 'II', price: 6 }])).toMatch(/birden fazla/); // Türkçe: I ile ı aynı harf
    expect(validateVariantRows([{ name: 'İİ', price: 5 }, { name: 'II', price: 6 }])).toBeNull(); // İ ve I farklı harf
  });

  it('temel fiyat en düşük seçenek; etiket ve satır adı', () => {
    const v = sanitizeVariants([{ name: '1 Litre', price: 60 }, { name: '330 ml', price: 25 }]);
    expect(basePrice(v, 99)).toBe(25);
    expect(basePrice(undefined, 99)).toBe(99);
    expect(priceLabel({ price: 25, variants: v }, (n) => `${n} ₺`)).toBe('25 ₺ – 60 ₺');
    expect(priceLabel({ price: 50 })).toBe('50');
    expect(variantLineName('Ayran', '1 Litre')).toBe('Ayran (1 Litre)');
    expect(hasVariants({ variants: v })).toBe(true);
    expect(hasVariants({ variants: [] })).toBe(false);
    expect(findVariant({ variants: v }, v[0].id)?.name).toBe('1 Litre');
    expect(findVariant({ variants: v }, 'yok')).toBeUndefined();
  });

  it('kasa: ürün seçenekleriyle kaydedilir, güncellenir, kaldırılınca temizlenir', async () => {
    const { rds } = await freshServices();
    const p = rds.addProduct({ name: 'Adana Kebap', categoryId: 'c', price: 280, variants: [{ id: 'a', name: '1 Porsiyon', price: 280 }, { id: 'b', name: '1,5 Porsiyon', price: 400 }] });
    expect(rds.getProducts().find((x: any) => x.id === p.id).variants).toHaveLength(2);
    rds.updateProduct(p.id, { variants: [{ id: 'a', name: '1 Porsiyon', price: 300 }], price: 300 });
    expect(rds.getProducts().find((x: any) => x.id === p.id).variants[0].price).toBe(300);
    rds.updateProduct(p.id, { variants: undefined, price: 280 });
    expect(rds.getProducts().find((x: any) => x.id === p.id).variants).toBeUndefined();
  });

  it('fişte seçenek adı ürün adıyla birlikte, kalem satırı olarak çıkar (mutfakta fiyat yok)', () => {
    const doc = buildTicketDoc('KITCHEN', { ticketTitle: 'BAR', tableName: 'Masa 3', items: [{ name: 'Ayran (1 Litre)', quantity: 2, price: 60 }, { name: 'Adana Kebap (1,5 Porsiyon)', quantity: 1, price: 400 }] });
    const html = doc.toHtml();
    expect(html).toContain('2 x Ayran (1 Litre)');
    expect(html).toContain('1 x Adana Kebap');
    expect(html).toContain('1,5 PORSİYON');
    expect(html).not.toMatch(/60|400/);
  });
});
