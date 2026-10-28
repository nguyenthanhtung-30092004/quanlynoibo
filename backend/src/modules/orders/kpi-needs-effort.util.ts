/** Số nhân viên hiện trong mục "cần cố gắng" */
export const NEEDS_EFFORT_COUNT = 3;

export interface StaffTally {
  staffId: number;
  fullName: string;
  total: number;
  seats: number;
}

/**
 * Nhân viên cần cố gắng: ít vé nhất (bằng vé thì ít đơn hơn, bằng nữa thì theo tên), phần tử đầu là "top 1" tức ít nhất.
 *
 * - `roster`: mọi nhân viên đang hoạt động, kể cả người chưa có đơn nào (số liệu lấy từ `ranking`, thiếu thì là 0).
 * - Người đã lên bục vinh danh (`podiumIds`) không xuất hiện ở đây để hai mục không trùng nhau.
 * - `onlyIds` khác rỗng (Admin đang lọc theo nhân viên) thì chỉ xét những người đó.
 * - Trả về rỗng khi cả kỳ không ai bán được vé nào: lúc đó không có gì để so sánh.
 */
export function pickNeedsEffort(
  roster: ReadonlyArray<{ id: number; fullName: string }>,
  ranking: readonly StaffTally[],
  podiumIds: ReadonlySet<number>,
  onlyIds: ReadonlySet<number> = new Set(),
): StaffTally[] {
  if (!ranking.some((r) => r.seats > 0)) return [];
  const tallyOf = new Map(ranking.map((r) => [r.staffId, r]));
  return roster
    .filter((u) => !podiumIds.has(u.id) && (onlyIds.size === 0 || onlyIds.has(u.id)))
    .map((u) => ({
      staffId: u.id,
      fullName: u.fullName,
      total: tallyOf.get(u.id)?.total ?? 0,
      seats: tallyOf.get(u.id)?.seats ?? 0,
    }))
    .sort((a, b) => a.seats - b.seats || a.total - b.total || a.fullName.localeCompare(b.fullName, 'vi'))
    .slice(0, NEEDS_EFFORT_COUNT);
}
