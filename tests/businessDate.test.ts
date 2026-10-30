import { describe, it, expect } from 'vitest';
import { getBusinessDate, formatLocalDate } from '../src/utils/businessDate';

// Yerel saat kullanıldığı için tarihler yerel kurucu ile üretilir (saat dilimi bağımsız test).
describe('iş günü', () => {
  it('gece yarısından sonra (00:30) önceki iş gününe yazılır', () => {
    expect(getBusinessDate(new Date(2026, 9, 31, 0, 30))).toBe('2026-10-30');
  });
  it('sabah 04:59 hâlâ önceki iş günü, 05:00 yeni gün', () => {
    expect(getBusinessDate(new Date(2026, 9, 31, 4, 59))).toBe('2026-10-30');
    expect(getBusinessDate(new Date(2026, 9, 31, 5, 0))).toBe('2026-10-31');
  });
  it('akşam 23:59 aynı gün', () => {
    expect(getBusinessDate(new Date(2026, 9, 30, 23, 59))).toBe('2026-10-30');
  });
  it('ay ve yıl sınırını doğru geçer', () => {
    expect(getBusinessDate(new Date(2026, 0, 1, 2, 0))).toBe('2025-12-31');
    expect(getBusinessDate(new Date(2026, 2, 1, 1, 0))).toBe('2026-02-28');
  });
  it('özel kesme saati', () => {
    expect(getBusinessDate(new Date(2026, 9, 31, 3, 0), 4)).toBe('2026-10-30');
    expect(getBusinessDate(new Date(2026, 9, 31, 3, 0), 0)).toBe('2026-10-31');
  });
  it('formatLocalDate UTC kaymasına uğramaz', () => {
    expect(formatLocalDate(new Date(2026, 9, 30, 0, 5))).toBe('2026-10-30');
  });
});
