/** 523 -> "8 giờ 43 phút", 90 -> "1 giờ 30 phút", 120 -> "2 giờ", 30 -> "30 phút" */
export function durationText(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

/** 2 -> "2 giờ", 1.5 -> "1,5 giờ" (giờ tăng ca tính theo mốc 0,5 giờ) */
export function overtimeText(hours: number): string {
  return `${String(hours).replace('.', ',')} giờ`;
}
