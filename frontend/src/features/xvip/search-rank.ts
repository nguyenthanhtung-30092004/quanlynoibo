/** Bỏ dấu và chữ hoa để gõ "ha noi" vẫn ra "Hà Nội" */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();

/**
 * Lọc và xếp gợi ý: khớp từ đầu tên xếp trước (gõ "hà nội" ra các tuyến "Hà Nội - ..." trước),
 * rồi tới khớp đầu một từ, cuối cùng mới là chứa chuỗi ở giữa; trong cùng nhóm giữ thứ tự cũ.
 * `query` đã được fold; trả về rỗng-lọc khi không khớp.
 */
export function rankMatches<T>(items: T[], query: string, getLabel: (item: T) => string): T[] {
  const words = query.split(/\s+/).filter(Boolean);
  const rank = (n: string) => {
    if (n.startsWith(query)) return 0;
    if (n.includes(` ${query}`) || n.includes(`- ${query}`)) return 1;
    return 2;
  };
  return items
    .map((item, i) => ({ item, i, n: fold(getLabel(item)) }))
    .filter(({ n }) => words.every((w) => n.includes(w)))
    .sort((a, b) => rank(a.n) - rank(b.n) || a.i - b.i)
    .map(({ item }) => item);
}
