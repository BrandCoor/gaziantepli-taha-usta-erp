/**
 * İş günü (business date) yardımcıları.
 *
 * Restoranlar gece yarısından sonra da çalışır; gece 00:30'daki satış bir önceki iş gününe aittir.
 * Eskiden `new Date().toISOString().split('T')[0]` (UTC tarihi) kullanılıyordu; bu, Türkiye'de
 * yalnızca tesadüfen 03:00 sınırı veriyordu ve sunucu/ayar değişince bozuluyordu.
 *
 * Burada YEREL saat esas alınır ve gün değişimi `cutoffHour` (varsayılan 05:00) ile açıkça belirlenir.
 */
export const DEFAULT_BUSINESS_DAY_CUTOFF_HOUR = 5;

const pad = (n: number) => String(n).padStart(2, '0');

/** Yerel takvim tarihini YYYY-MM-DD olarak verir (UTC'ye çevirmeden). */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Verilen an için iş günü. cutoffHour'dan önceki saatler bir önceki güne yazılır. */
export function getBusinessDate(now: Date = new Date(), cutoffHour: number = DEFAULT_BUSINESS_DAY_CUTOFF_HOUR): string {
  const shifted = new Date(now.getTime() - cutoffHour * 3600 * 1000);
  return formatLocalDate(shifted);
}
