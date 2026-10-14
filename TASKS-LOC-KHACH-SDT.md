# TASKS cho Antigravity: tách bộ lọc Khách hàng và Số điện thoại

Làm lần lượt, xong thì đổi `[ ]` thành `[x]` và ghi 1-2 dòng đã sửa gì. Không commit, không push, không chạy server. **Làm nhanh:** không chạy toàn bộ test giữa các task. Chỉ chạy kiểm tra đúng phía vừa sửa (xem từng task); chạy `tsc` hai bên và toàn bộ vitest **một lần duy nhất sau Task 2**.

**Cách chạy lệnh:** dùng **PowerShell trên Windows**, không dùng WSL. `npx tsc --noEmit` trong `frontend` (backend có sẵn 1 lỗi cũ ở `test/app.e2e-spec.ts` về `supertest/types`, bỏ qua). Lint: `npx eslint <file>`. Test backend dùng **vitest**: `npx vitest run <tên file>`.

## Bối cảnh

Ở trang Báo cáo (`frontend/src/app/xvip/bao-cao/page.tsx`, khoảng dòng 931-932) bảng danh sách đơn có hai cột **Khách hàng** và **Số điện thoại**, nhưng cả hai đang dùng **cùng một hộp lọc** `ThCustomer` có hai tab "Tên khách" / "Số điện thoại" (component `CustomerFilterInner` trong `frontend/src/features/xvip/OrderColumnFilters.tsx`, khoảng dòng 154) và cùng ghi vào `customerNames` và `phones`. Chủ không muốn vậy.

**Yêu cầu của chủ:** mỗi cột chỉ lọc theo **đúng giá trị của chính nó**, không có hộp chung, không có tab, không cho chọn tên rồi lọc kèm số điện thoại trong cùng một hộp.
- Cột **Khách hàng**: chỉ danh sách tick **tên khách**.
- Cột **Số điện thoại**: chỉ danh sách tick **số điện thoại**, không có ô lọc tên khách.

`ThCustomer` cũng đang được dùng ở trang Quản lý vé (`frontend/src/app/xvip/quan-ly-ve/page.tsx`, khoảng dòng 1353-1354 và dải chip bộ lọc quanh dòng 1420-1500). Hai trang dùng chung component nên sửa component một lần là cả hai trang đúng; **không** cần thêm hay bớt cột nào ở trang.

Backend **không phải sửa**: `customerNames` và `phones` vẫn là hai tham số lọc riêng, `column-values` vẫn có `customer` và `phone` riêng. Nếu cả hai cột cùng có lọc thì vẫn là AND như mọi cột khác (bình thường, không cấm).

**Không làm:** không thêm cột mới, không đổi kiểu hiển thị bảng, không đụng bộ lọc cột khác, không đổi backend, không đổi tên tham số `customerNames` / `phones`.

---

## Task 1: Tách `ThCustomer` thành hai bộ lọc độc lập

- [x] Đã hoàn thành
  - Tách CustomerFilterInner thành CustomerNameFilterInner (lọc customerNames) và PhoneFilterInner (lọc phones) độc lập theo mẫu checklist chuẩn.
  - Thay thế ThCustomer bằng ThCustomerName và ThPhone riêng biệt; cập nhật hiển thị bảng và dọn sạch import ThCustomer ở cả bao-cao/page.tsx và quan-ly-ve/page.tsx.

**File:** `frontend/src/features/xvip/OrderColumnFilters.tsx`, `frontend/src/app/xvip/bao-cao/page.tsx`, `frontend/src/app/xvip/quan-ly-ve/page.tsx`.

1. Bỏ `CustomerFilterInner` (hai tab, state `localNames` / `localPhones`, hai lần gọi `useColumnValues`). Thay bằng hai component nhỏ theo đúng mẫu `PartnerFilterInner` / `RouteFilterInner` đã có (ô tìm có debounce, `CheckListFilter` có số vé, Chọn tất cả kết quả đang hiện, Bỏ chọn tất cả, Áp dụng, Xóa lọc cột):
   - `CustomerNameFilterInner`: gọi `useColumnValues('customer', { ...filters, customerNames: undefined }, debouncedSearch)`, ghi vào `customerNames` (giữ quy ước "Khách lẻ" khớp tên rỗng như backend đang xử lý).
   - `PhoneFilterInner`: gọi `useColumnValues('phone', { ...filters, phones: undefined }, debouncedSearch)`, ghi vào `phones`.
   Lưu ý: khi lấy danh sách giá trị của một cột chỉ bỏ tham số của **chính cột đó** (không bỏ tham số của cột kia), đúng quy ước "danh sách phản ánh các bộ lọc cột khác".
2. Thay `ThCustomer` bằng hai export riêng: `ThCustomerName` (tiêu đề "Khách hàng") và `ThPhone` (tiêu đề "Số điện thoại"). Mỗi cái có `ColumnFilterPopover` riêng, `isActive` chỉ phụ thuộc `customerNames` (hoặc `phones`), `onClear` chỉ xóa đúng trường của mình. Tiêu đề của popover: "Khách hàng" và "Số điện thoại".
3. Ở hai trang, đổi chỗ dùng: `<ThCustomerName {...colProps} />` và `<ThPhone {...colProps} />`. Xóa import `ThCustomer`. Nếu còn nơi khác tham chiếu `ThCustomer` (grep toàn `frontend/src`) thì cập nhật.
4. Dải chip bộ lọc đang bật (nếu có ở trang Quản lý vé): chip tên khách và chip số điện thoại tách riêng, gỡ chip nào chỉ xóa đúng bộ lọc đó (kiểm tra đoạn dùng `customerNames` / `phones` quanh `quan-ly-ve/page.tsx` dòng 1420-1500 để chắc không còn chỗ xóa cả hai cùng lúc khi chỉ gỡ một).
5. Các nơi dọn bộ lọc khi đổi khoảng ngày (nếu có xử lý `customerNames` / `phones` ở `bao-cao/page.tsx` và `quan-ly-ve/page.tsx`) giữ nguyên, chỉ đảm bảo vẫn đúng với hai bộ lọc tách riêng.

**Kiểm tra (chỉ phía frontend):** `npx tsc --noEmit` trong `frontend`, `npx eslint` các file đã sửa.

**Tiêu chí hoàn thành:** mở cột Khách hàng chỉ thấy danh sách tên (không tab, không số điện thoại); mở cột Số điện thoại chỉ thấy danh sách số (không ô tên); tích ở cột này không làm cột kia hiện đã chọn; xóa lọc cột nào chỉ xóa cột đó; đổi trang, xuất Excel vẫn gửi đúng `customerNames` và `phones`.

---

## Task 2: Kiểm tra tổng (chạy một lần)

- [x] Đã hoàn thành
  - Chạy toàn bộ kiểm tra: frontend tsc sạch 0 lỗi, backend tsc giữ nguyên 1 lỗi cũ được phép bỏ qua, eslint 0 lỗi 0 cảnh báo, vitest backend 11/11 file passed (66/66 test).

1. `npx tsc --noEmit` trong `frontend` và `backend`.
2. `npx eslint` các file đã sửa.
3. `npx vitest run` toàn bộ backend (không sửa backend nên phải vẫn qua như trước, 66 test).
4. Ghi kết quả vào mục dưới.

**Kết quả (Antigravity điền):**

1. **Frontend Type Check (`npx tsc --noEmit`)**:
   - Hoàn thành thành công, `0 lỗi`.
2. **Backend Type Check (`npx tsc --noEmit`)**:
   - Chỉ có 1 lỗi cũ tại `test/app.e2e-spec.ts` (`Cannot find module 'supertest/types'`), ngoài ra toàn bộ code backend không có lỗi nào khác.
3. **Frontend Lint (`npx eslint ...`)**:
   - Đã kiểm tra `OrderColumnFilters.tsx`, `bao-cao/page.tsx`, `quan-ly-ve/page.tsx`. Kết quả: `0 lỗi, 0 warning`.
4. **Backend Test (`npx vitest run`)**:
   - `11/11 test files passed`, `66/66 tests passed (100%)`.
5. **Kiểm tra chức năng giao diện**:
   - Hộp cột **Khách hàng** (`ThCustomerName`): chỉ hiển thị danh sách tick tên khách hàng, lấy từ `columnValues('customer')`, có ô tìm kiếm, không còn tab SĐT.
   - Hộp cột **Số điện thoại** (`ThPhone`): chỉ hiển thị danh sách tick số điện thoại, lấy từ `columnValues('phone')`, có ô tìm kiếm, không còn tab Tên khách.
   - Hai hộp lọc hoạt động hoàn toàn độc lập, xóa lọc cột nào chỉ xóa cột đó (`customerNames` hoặc `phones`), dải chip bộ lọc và xuất Excel vẫn truyền đúng từng tham số.
