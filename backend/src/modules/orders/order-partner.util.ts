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

/** Bỏ dấu, chữ thường, gộp khoảng trắng: "  Đất  Cảng " -> "dat cang" */
function foldKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tên viết tắt hay gặp trong file Excel -> tên đối tác đầy đủ trong hệ thống.
 * Khóa đã bỏ dấu + chữ thường; chỉ áp dụng khi TOÀN BỘ ô đối tác khớp khóa.
 */
const IMPORT_PARTNER_ALIASES: Record<string, string> = {
  'viet nam': 'X.E Việt Nam',
  'dat cang': 'Anh Huy Đất Cảng',
  'anh huy': 'Anh Huy 92',
};

/** Đổi tên viết tắt trong file import sang tên đối tác đầy đủ; tên khác giữ nguyên. */
export function applyImportPartnerAlias(rawPartner: string): string {
  return IMPORT_PARTNER_ALIASES[foldKey(rawPartner)] ?? rawPartner;
}

export interface HasPartner {
  partner?: string | null;
}

/**
 * Lọc danh sách đơn hoặc đối tượng có trường partner:
 * - Đơn không có đối tác (rỗng / chỉ khoảng trắng / null / undefined) -> giữ lại (hợp lệ).
 * - Đơn có đối tác khớp bảng đối tác -> giữ lại.
 * - Đơn có đối tác khác rỗng nhưng không khớp bảng đối tác -> bị loại.
 * Trả về { valid: T[], excluded: T[] }.
 */
export function filterOrdersByPartner<T extends HasPartner>(
  orders: T[],
  partners: PartnerLike[],
): { valid: T[]; excluded: T[] } {
  const valid: T[] = [];
  const excluded: T[] = [];
  for (const o of orders) {
    const canonical = matchCanonicalPartner(o.partner, partners);
    if (canonical !== undefined) {
      valid.push(o);
    } else {
      excluded.push(o);
    }
  }
  return { valid, excluded };
}

export interface UnlistedPartnerSummary {
  partner: string;
  orders: number;
}

/**
 * Tìm và thống kê các tên đối tác trên đơn không khớp bảng đối tác.
 * - Gom theo tên không phân biệt hoa thường.
 * - Sắp xếp theo số đơn giảm dần.
 */
export function findUnlistedPartners<T extends HasPartner>(
  orders: T[],
  partners: PartnerLike[],
): UnlistedPartnerSummary[] {
  const map = new Map<string, { partner: string; orders: number }>();
  for (const o of orders) {
    if (matchCanonicalPartner(o.partner, partners) === undefined) {
      const raw = o.partner!.trim();
      const key = raw.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.orders += 1;
      } else {
        map.set(key, { partner: raw, orders: 1 });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.orders - a.orders);
}
