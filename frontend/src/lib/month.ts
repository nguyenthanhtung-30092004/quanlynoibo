/** Cộng / trừ tháng cho chuỗi YYYY-MM */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const monthLabel = (month: string) => `Tháng ${month.slice(5)}/${month.slice(0, 4)}`;
