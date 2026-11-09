/** Mục "Đăng ký nghỉ": nhân viên hay dùng nên trên điện thoại được đưa lên vị trí thứ 2 */
export const LEAVE_HREF = '/xvip/nghi-phep';

/** Mục "Báo cáo": luôn ở vị trí thứ 4 của menu (cả máy tính lẫn điện thoại, Admin lẫn nhân viên) */
export const REPORTS_HREF = '/xvip/bao-cao';
const REPORTS_POSITION = 4;

/** Các mục ít dùng, trên điện thoại được đẩy xuống cuối menu theo đúng thứ tự này */
export const RARELY_USED_HREFS = ['/xvip/doi-tac', '/xvip/tuyen-duong'];

/**
 * Thứ tự menu trên điện thoại, tính trên các mục đã lọc theo quyền (Admin / nhân viên):
 * "Đăng ký nghỉ" ở vị trí thứ 2, các mục ít dùng nằm dưới cùng, còn lại giữ thứ tự gốc.
 * Máy tính vẫn dùng thứ tự gốc của danh sách, hàm này chỉ cho bản điện thoại.
 */
export function orderForMobile<T extends { href: string }>(items: readonly T[]): T[] {
  const leave = items.find((i) => i.href === LEAVE_HREF);
  const tail = RARELY_USED_HREFS.map((href) => items.find((i) => i.href === href)).filter((i): i is T => !!i);
  const rest = items.filter((i) => i !== leave && !tail.includes(i));
  if (leave) rest.splice(Math.min(1, rest.length), 0, leave);
  return [...rest, ...tail];
}

/** Đưa "Báo cáo" về vị trí thứ 4 của danh sách đã lọc theo quyền; danh sách ngắn hơn thì xếp cuối */
export function withReportsFourth<T extends { href: string }>(items: readonly T[]): T[] {
  const reports = items.find((i) => i.href === REPORTS_HREF);
  if (!reports) return [...items];
  const rest = items.filter((i) => i !== reports);
  rest.splice(Math.min(REPORTS_POSITION - 1, rest.length), 0, reports);
  return rest;
}
