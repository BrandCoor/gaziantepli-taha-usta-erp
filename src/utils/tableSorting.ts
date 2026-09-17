export interface SortableTable {
  id?: string;
  name?: string;
  sectionId?: string;
  sectionName?: string;
  [key: string]: any;
}

export interface SortableSection {
  id: string;
  name?: string;
  sira?: number;
  order?: number;
  [key: string]: any;
}

/**
 * Masa adı veya ID'sinden sayısal masa numarasını çıkarır.
 * Ör: "Ana Salon 1" -> 1, "Ana Salon 10" -> 10, "tbl-sec-salon-2" -> 2
 */
export function extractTableNumber(table: SortableTable): number {
  if (table.name) {
    const matches = table.name.match(/\d+/g);
    if (matches && matches.length > 0) {
      const num = parseInt(matches[matches.length - 1], 10);
      if (!isNaN(num)) return num;
    }
  }
  if (table.id) {
    const matches = table.id.match(/\d+/g);
    if (matches && matches.length > 0) {
      const num = parseInt(matches[matches.length - 1], 10);
      if (!isNaN(num)) return num;
    }
  }
  return 0;
}

/**
 * Masaları Küçükten Büyüğe (1, 2, 3... 10, 11, 12) ve Salon Sırasına göre doğal sıralar.
 */
export function sortTablesNaturally<T extends SortableTable>(
  tables: T[],
  sections?: SortableSection[]
): T[] {
  if (!Array.isArray(tables)) return [];

  const sectionOrderMap = new Map<string, number>();
  if (sections && Array.isArray(sections)) {
    sections.forEach((s, index) => {
      const order = s.sira ?? s.order ?? index;
      sectionOrderMap.set(s.id, order);
    });
  }

  const collator = new Intl.Collator('tr-TR', { numeric: true, sensitivity: 'base' });

  return [...tables].sort((a, b) => {
    // 1. Önce Salon Sıralaması
    const secA = a.sectionId || '';
    const secB = b.sectionId || '';

    if (secA !== secB) {
      const orderA = sectionOrderMap.has(secA) ? sectionOrderMap.get(secA)! : 999;
      const orderB = sectionOrderMap.has(secB) ? sectionOrderMap.get(secB)! : 999;
      if (orderA !== orderB) return orderA - orderB;
      const secNameComp = collator.compare(a.sectionName || secA, b.sectionName || secB);
      if (secNameComp !== 0) return secNameComp;
    }

    // 2. Masa Numarası (Küçükten Büyüğe: 1, 2, 3... 9, 10, 11...)
    const numA = extractTableNumber(a);
    const numB = extractTableNumber(b);

    if (numA !== 0 && numB !== 0 && numA !== numB) {
      return numA - numB;
    }

    // 3. İsim Doğal Sıralaması (Fallback)
    return collator.compare(a.name || a.id || '', b.name || b.id || '');
  });
}
