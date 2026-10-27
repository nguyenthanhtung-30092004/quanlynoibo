/** Số nhân viên hiện trong mục "cần cố gắng" */
export const NEEDS_EFFORT_COUNT = 3;

export interface StaffTally {
  staffId: number;
  fullName: string;
  total: number;
  seats: number;
}

/**
 * Khoảng ngày của tháng chứa `day` ('YYYY-MM-DD' hoặc 'YYYY-MM'): ngày đầu, ngày cuối và nhãn tháng 'YYYY-MM'.
 */
export function monthRangeOf(day: string): { month: string; from: string; to: string } {
  const month = day.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { month, from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * Nhân viên cần cố gắng trong một tháng: ít vé nhất (bằng vé thì ít đơn hơn, bằng nữa thì theo tên),
 * phần tử đầu là "top 1" tức ít nhất.
 *
 * - `roster`: mọi nhân viên đang hoạt động, kể cả người chưa có đơn nào trong tháng (số liệu lấy từ `monthly`, thiếu thì là 0).
 * - Trả về rỗng khi cả tháng không ai bán được vé nào: lúc đó không có gì để so sánh.
 */
export function pickNeedsEffort(
  roster: ReadonlyArray<{ id: number; fullName: string }>,
  monthly: ReadonlyArray<{ staffId: number; total: number; seats: number }>,
): StaffTally[] {
  if (!monthly.some((r) => r.seats > 0)) return [];
  const tallyOf = new Map(monthly.map((r) => [r.staffId, r]));
  return roster
    .map((u) => ({
      staffId: u.id,
      fullName: u.fullName,
      total: tallyOf.get(u.id)?.total ?? 0,
      seats: tallyOf.get(u.id)?.seats ?? 0,
    }))
    .sort((a, b) => a.seats - b.seats || a.total - b.total || a.fullName.localeCompare(b.fullName, 'vi'))
    .slice(0, NEEDS_EFFORT_COUNT);
}
