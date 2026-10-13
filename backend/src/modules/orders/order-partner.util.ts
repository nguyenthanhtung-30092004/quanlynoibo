export interface PartnerLike {
  name: string;
}

/**
 * Tìm tên đối tác chuẩn từ danh sách đối tác theo tên (không phân biệt hoa thường, bỏ khoảng trắng đầu/cuối).
 * - rawPartner rỗng / chỉ khoảng trắng / null / undefined -> trả về null (hợp lệ cho đơn không gán đối tác).
 * - Khớp -> trả về tên chuẩn trong danh sách đối tác.
 * - Không khớp -> trả về undefined.
 */
export function matchCanonicalPartner(
  rawPartner: string | null | undefined,
  partners: PartnerLike[],
): string | null | undefined {
  if (!rawPartner || !rawPartner.trim()) {
    return null;
  }
  const needle = rawPartner.trim().toLowerCase();
  const matched = partners.find((p) => p.name.trim().toLowerCase() === needle);
  return matched ? matched.name : undefined;
}
