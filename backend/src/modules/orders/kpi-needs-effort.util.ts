/** Số nhân viên hiện trong mục "cần cố gắng" */
export const NEEDS_EFFORT_COUNT = 3;

export interface StaffTally {
  staffId: number;
  fullName: string;
  total: number;
  seats: number;
  /** Doanh số (hoa hồng) */
  commission?: number;
}

/** Tiêu chí xếp hạng: theo vé, theo đơn hoặc theo doanh số */
export type StaffMetric = 'seats' | 'orders' | 'commission';

/** Giá trị của một nhân viên theo tiêu chí */
export function metricValue(t: StaffTally, metric: StaffMetric): number {
  return metric === 'seats' ? t.seats : metric === 'orders' ? t.total : (t.commission ?? 0);
}

/** So sánh nhiều vé nhất trước: theo tiêu chí, bằng nhau thì theo vé, đơn, doanh số rồi tên */
export function compareStaff(metric: StaffMetric) {
  return (a: StaffTally, b: StaffTally) =>
    metricValue(b, metric) - metricValue(a, metric) ||
    b.seats - a.seats ||
    b.total - a.total ||
    (b.commission ?? 0) - (a.commission ?? 0) ||
    a.fullName.localeCompare(b.fullName, 'vi');
}

/**
 * Nhân viên cần cố gắng: ít nhất theo tiêu chí `metric` (mặc định là vé; bằng nhau thì ít vé, ít đơn hơn, rồi theo tên),
 * phần tử đầu là "top 1" tức ít nhất.
 *
 * - `roster`: mọi nhân viên đang hoạt động, kể cả người chưa có đơn nào (số liệu lấy từ `ranking`, thiếu thì là 0).
 * - Người đã lên bục vinh danh (`podiumIds`) không xuất hiện ở đây để hai mục không trùng nhau.
 * - `onlyIds` khác rỗng (Admin đang lọc theo nhân viên) thì chỉ xét những người đó.
 * - `clockedInIds`: chỉ xét người đã chấm công vào trong khoảng ngày đang xem; ai chưa quẹt máy chấm công thì chưa tính
 *   (chưa đi làm thì chưa thể gọi là chưa cố gắng). Bỏ trống thì không lọc theo chấm công.
 * - Trả về rỗng khi cả kỳ không ai đạt giá trị nào theo tiêu chí: lúc đó không có gì để so sánh.
 */
export function pickNeedsEffort(
  roster: ReadonlyArray<{ id: number; fullName: string }>,
  ranking: readonly StaffTally[],
  podiumIds: ReadonlySet<number>,
  onlyIds: ReadonlySet<number> = new Set(),
  clockedInIds?: ReadonlySet<number>,
  metric: StaffMetric = 'seats',
): StaffTally[] {
  if (!ranking.some((r) => metricValue(r, metric) > 0)) return [];
  const tallyOf = new Map(ranking.map((r) => [r.staffId, r]));
  return roster
    .filter(
      (u) =>
        !podiumIds.has(u.id) &&
        (onlyIds.size === 0 || onlyIds.has(u.id)) &&
        (!clockedInIds || clockedInIds.has(u.id)),
    )
    .map((u) => ({
      staffId: u.id,
      fullName: u.fullName,
      total: tallyOf.get(u.id)?.total ?? 0,
      seats: tallyOf.get(u.id)?.seats ?? 0,
      commission: tallyOf.get(u.id)?.commission ?? 0,
    }))
    .sort(
      (a, b) =>
        metricValue(a, metric) - metricValue(b, metric) ||
        a.seats - b.seats ||
        a.total - b.total ||
        a.fullName.localeCompare(b.fullName, 'vi'),
    )
    .slice(0, NEEDS_EFFORT_COUNT);
}
