/** Bỏ dấu và chữ hoa để gõ "ha noi" vẫn ra "Hà Nội" */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Khớp khi mọi từ gõ vào đều có trong nhãn (bỏ dấu, không phân biệt khoảng trắng lạ) */
export const matchesAllWords = (label: string, input: string) => {
  const n = fold(label);
  return fold(input)
    .split(' ')
    .filter(Boolean)
    .every((w) => n.includes(w));
};

/** Dùng cho `filterOption` / `filterSort` của antd Select: khớp đầu nhãn xếp trước, khớp giữa nhãn xếp sau */
export const antdSearch = {
  filterOption: (input: string, option?: { label?: unknown }) =>
    matchesAllWords(String(option?.label ?? ''), input),
  filterSort: (
    a: { label?: unknown },
    b: { label?: unknown },
    { searchValue }: { searchValue: string },
  ) => {
    const q = fold(searchValue);
    const rank = (o: { label?: unknown }) => (fold(String(o.label ?? '')).startsWith(q) ? 0 : 1);
    return rank(a) - rank(b);
  },
};

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
