import Decimal from 'decimal.js';

export function formatCurrency(amount: number | string | Decimal | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0,00 ₺';
  }
  const dec = new Decimal(amount);
  const parts = dec.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPart = parts[1];
  return `${integerPart},${decimalPart} ₺`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}