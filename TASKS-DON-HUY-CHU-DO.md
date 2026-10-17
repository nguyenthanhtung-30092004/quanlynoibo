# TASKS cho Antigravity: đơn bị khách hủy thì toàn bộ chữ trên dòng đó chuyển sang màu đỏ

Làm lần lượt từng task. Xong task nào thì đổi `[ ]` thành `[x]` và ghi 1-2 dòng đã sửa gì. Không commit, không push, không chạy server.

**Làm nhanh, không chạy full suite giữa các task.** Đây là thay đổi thuần giao diện (frontend), không đụng backend, không cần test backend.

**Cách chạy lệnh:** dùng **PowerShell trên Windows**, không dùng WSL. Mỗi task chỉ chạy `npx eslint <file đã sửa>` trong `frontend`. Chạy `npx tsc --noEmit` trong `frontend` **một lần duy nhất sau task cuối**.

## Bối cảnh

Khi bấm "Hủy vé", backend gán `cancelledAt` (không null) cho đơn. Frontend hiện đã nhận biết đơn hủy qua `order.cancelledAt` (xem `frontend/src/features/orders/types.ts` dòng 62), nhưng hiển thị hiện tại chỉ là **dòng mờ xám** (`bg-slate-50 opacity-60`) kèm nhãn nhỏ "Đã hủy" ở cột Mã đơn. Chủ muốn: **đơn đã hủy thì toàn bộ chữ trên dòng đó hiện màu đỏ** để nhìn là biết ngay.

Có **2 bảng** hiển thị danh sách đơn cần sửa:

| Bảng | File | Đoạn cần sửa |
|---|---|---|
| Quản lý vé | `frontend/src/features/orders/components/OrdersTableView.tsx` | thẻ `<tr>` ở dòng ~113-122 và nhãn "Đã hủy" ở dòng ~133-137 |
| Báo cáo | `frontend/src/app/xvip/bao-cao/page.tsx` | thẻ `<tr>` ở dòng ~1000-1007 và nhãn "Đã hủy" ở dòng ~1013-1017 |

**Vì sao không chỉ đổi màu trên `<tr>`:** mỗi ô `<td>` trong hai bảng đều tự gán màu chữ riêng (`text-slate-800`, `text-blue-700`, `text-red-600`, `text-emerald-700`...). Màu chữ đặt ở `<tr>` sẽ bị các ô đó ghi đè nên không có tác dụng. Vì vậy cần một class CSS dùng chung, ép màu xuống mọi ô con.

**Không sửa** `frontend/src/features/orders/components/OrdersTable.tsx` (file không còn được import ở đâu, là code cũ).

---

## Task 1: Thêm class CSS dùng chung `order-row-cancelled`

- [x] Đã làm: Thêm các quy tắc CSS cho `.order-row-cancelled` và `html.dark .order-row-cancelled` vào cuối file `frontend/src/app/globals.css` để ép chữ đỏ (loại trừ `.cancel-badge`).

**File:** `frontend/src/app/globals.css` (thêm vào cuối file hoặc cạnh các class tương tự; dự án dùng Tailwind 3 và chế độ tối bằng `html.dark`, **không** dùng `prefers-color-scheme`).

Thêm đúng các quy tắc sau (có thể chỉnh cú pháp cho khớp phong cách file):

```css
/* Đơn đã hủy: ép mọi chữ trong dòng sang màu đỏ (ô <td> đang tự gán màu riêng nên phải dùng !important) */
.order-row-cancelled > td,
.order-row-cancelled > td *:not(.cancel-badge) {
  color: #dc2626 !important; /* red-600 */
}
html.dark .order-row-cancelled > td,
html.dark .order-row-cancelled > td *:not(.cancel-badge) {
  color: #f87171 !important; /* red-400, dễ đọc trên nền tối */
}
```

Giải thích để không làm sai:
- `.cancel-badge` là nhãn "Đã hủy" nhỏ ở cột Mã đơn, nó có nền đỏ nhạt + chữ đỏ đậm riêng, **loại ra** khỏi quy tắc để giữ nguyên kiểu nhãn.
- Selector `td *` phủ cả `<span>`, `<div>` bên trong ô (ví dụ "Đã gửi SMS", ngày giờ gửi). Biểu tượng `CheckCircle` dùng `currentColor` nên cũng đỏ theo, chấp nhận được.

**Không làm:** không sửa các class khác trong `globals.css`, không đổi biến màu, không thêm file CSS mới.

**Tiêu chí hoàn thành:** `globals.css` có đủ 2 khối trên; không có lỗi cú pháp CSS.

---

## Task 2: Áp dụng ở bảng Quản lý vé

- [x] Đã làm: Cập nhật thẻ `<tr>` cho đơn hủy thành `order-row-cancelled bg-rose-50/60 dark:bg-rose-950/20` (bỏ `opacity-60`) và thêm class `cancel-badge` vào nhãn "Đã hủy" trong `OrdersTableView.tsx`. Eslint kiểm tra không có lỗi.

**File:** `frontend/src/features/orders/components/OrdersTableView.tsx`

1. Ở `<tr>` (dòng ~113-122): đổi nhánh `t.cancelledAt` từ `'bg-slate-50 opacity-60 dark:bg-slate-900/60'` thành `'order-row-cancelled bg-rose-50/60 dark:bg-rose-950/20'`.
   - **Bỏ `opacity-60`**: nếu để mờ thì chữ đỏ bị nhạt, khó đọc.
   - Giữ nguyên các class còn lại của `<tr>` (`group cursor-pointer hover:bg-blue-50/70 ...`) và `onClick`/`title`.
2. Ở nhãn "Đã hủy" (dòng ~134): thêm class `cancel-badge` vào `className` của `<span>`, giữ nguyên toàn bộ class cũ.

**Không làm:** không đổi màu chữ trong từng `<td>` (class `order-row-cancelled` lo hết), không thêm cột, không đổi thứ tự cột, không đổi logic lọc/phân trang, không sửa dòng thường (không hủy).

**Kiểm tra:** `npx eslint src/features/orders/components/OrdersTableView.tsx`

---

## Task 3: Áp dụng ở bảng Báo cáo

- [x] Đã làm: Cập nhật thẻ `<tr>` cho đơn hủy thành `order-row-cancelled bg-rose-50/60 dark:bg-rose-950/20` (bỏ `opacity-60`) và thêm class `cancel-badge` vào nhãn "Đã hủy" trong `src/app/xvip/bao-cao/page.tsx`. Eslint kiểm tra không có lỗi.

**File:** `frontend/src/app/xvip/bao-cao/page.tsx`

1. Ở `<tr>` (dòng ~1004-1006): đổi nhánh `t.cancelledAt` từ `'bg-slate-50 opacity-60 dark:bg-slate-900/60'` thành `'order-row-cancelled bg-rose-50/60 dark:bg-rose-950/20'`. Giữ nguyên các class khác của `<tr>`.
2. Ở nhãn "Đã hủy" (dòng ~1014): thêm class `cancel-badge`, giữ nguyên class cũ.
3. Ô "Lý do hủy" cuối dòng (dòng ~1105) đang có `text-rose-600 dark:text-rose-400`: để nguyên, không cần sửa (đã đỏ, class mới cũng ép đỏ giống nhau).

**Không làm:** không sửa phần KPI, bộ lọc, xuất Excel hay bất kỳ phần nào khác của trang (file rất dài, chỉ sửa đúng 2 chỗ trên).

**Kiểm tra:** `npx eslint src/app/xvip/bao-cao/page.tsx`

---

## Task 4: Kiểm tra cuối (chạy đúng một lần)

- [x] Đã làm: Chạy `npx tsc --noEmit` thành công (0 lỗi). Đã rà soát xác nhận: không còn `opacity-60` ở nhánh đơn hủy; cả hai bảng đều có đủ và đúng vị trí `order-row-cancelled` và `cancel-badge`.

1. Trong `frontend`: `npx tsc --noEmit` — không được thêm lỗi mới.
2. Rà bằng mắt (không cần chạy server): tìm `opacity-60` trong hai file ở Task 2-3 để chắc chắn đã bỏ ở nhánh đơn hủy; tìm `order-row-cancelled` và `cancel-badge` để chắc chắn mỗi bảng có đủ, đúng chỗ.

## Ngoài phạm vi (nếu thấy cần thì ghi chú lại, đừng tự làm)

- Không sửa backend, không đổi API, không thêm trường mới.
- Không đổi `OrderDetailModal` (hộp chi tiết đã có khung báo "Đơn đã hủy" riêng).
- Không thêm bộ lọc "đơn đã hủy", không thêm cột, không đổi cách tính KPI.
- Không reformat code không liên quan.

## Tiêu chí hoàn thành chung

Đơn có `cancelledAt` ở cả Quản lý vé và Báo cáo: mọi chữ trong dòng (STT, mã đơn, ngày, khách, SĐT, giá, tuyến, tin nhắn, lý do hủy...) hiện màu đỏ ở cả giao diện sáng lẫn tối, dòng không còn bị mờ; nhãn "Đã hủy" giữ kiểu nhãn riêng; đơn không hủy giữ nguyên như cũ; `tsc` và eslint không thêm lỗi mới.
