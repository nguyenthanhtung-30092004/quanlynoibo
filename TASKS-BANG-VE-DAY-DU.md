# TASKS cho AI: bảng danh sách vé ở Báo cáo hiện đủ mọi trường + cột Đã cọc hiện 0đ

Làm lần lượt, xong thì đổi `[ ]` thành `[x]` và ghi 1-2 dòng đã sửa gì. Không commit, không push, không chạy server. **Làm nhanh:** không chạy toàn bộ test giữa các task. Chỉ chạy kiểm tra đúng phía vừa sửa; chạy `tsc` hai bên và toàn bộ vitest **một lần duy nhất sau Task 3**.

**Cách chạy lệnh:** dùng **PowerShell trên Windows**, không dùng WSL. `npx tsc --noEmit` trong `frontend` và `backend` (backend có sẵn 1 lỗi cũ ở `test/app.e2e-spec.ts` về `supertest/types`, bỏ qua). Lint: `npx eslint <file>` ở frontend. Test backend dùng **vitest**: `npx vitest run <tên file>`.

## Bối cảnh

Bảng "Danh sách đơn" ở trang Báo cáo (`frontend/src/app/xvip/bao-cao/page.tsx`, khối `<ScrollTable>` khoảng dòng 923-1030) hiện chỉ có 12 cột: STT, Mã đơn, Giờ xe, Nhà xe, Tuyến đường, Khách hàng, Số điện thoại, Giá bán, Đã cọc, Hoa hồng, NV tạo, Tin nhắn. Chủ muốn bảng này **hiện đầy đủ mọi trường thông tin của một vé** để xem một lượt, không phải bấm vào từng đơn.

Kiểu dữ liệu `Order` (`frontend/src/features/orders/types.ts`) đã có sẵn đủ trường, API `GET /orders` đã trả đủ (xem `toView` trong `backend/src/modules/orders/orders.service.ts`), nên **không cần sửa backend** cho phần hiển thị.

Hai phần chủ yêu cầu:
1. Báo cáo: hiện **tất cả** trường của vé, đặc biệt **số ghế, loại hình, ghế đầu, ghế giữa, ghế cuối**. Bảng chỉ để xem, **không thêm cột Thao tác** (không nút Sửa/Hủy/Xóa/Đặt lại).
2. Cả Báo cáo lẫn Quản lý vé: cột **Đã cọc** nếu chưa cọc thì hiện **`0đ`**, **không** hiện chữ "Chưa cọc".

**Không làm:** không thêm cột Thao tác vào Báo cáo, không đổi bảng ở trang Quản lý vé ngoài chuyện hiển thị chữ "Chưa cọc" thành `0đ`, không đổi logic lọc/phân trang, không đổi các bộ lọc cột đã có (ngoài việc đổi chữ "Hoa hồng" thành "Doanh số" ở Báo cáo như Task 1 điểm 7), không đổi backend ngoài nhãn nói ở Task 2. Nếu thấy cần thêm gì ngoài danh sách, **ghi chú lại để hỏi chủ** chứ đừng tự làm.

---

## Task 1: Báo cáo, bảng danh sách đơn hiện đủ mọi trường

- [x] Đã xong. Đã mở rộng bảng danh sách đơn Báo cáo lên 26 cột đúng thứ tự và định dạng (tách Ngày khởi hành & Giờ xe; thêm Ngày vào sổ, Loại hình, Điểm đón, Điểm trả, Số ghế/đầu/giữa/cuối, Tổng vé, Giá nhập, Nhờ thu, Ghi chú, Lý do hủy; đổi tiêu đề commission thành "Doanh số" ở Báo cáo và giữ "Hoa hồng" ở Quản lý vé; cập nhật colSpan=26).

**File:** `frontend/src/app/xvip/bao-cao/page.tsx` (cả `<thead>` và `<tbody>`, cập nhật `colSpan` của các hàng "Đang tải" / "Chưa có đơn", hiện đang là `12`). Dùng lại hằng `TH`, `TD`, `NUM` và `ScrollTable` có sẵn (bảng đã có thanh kéo ngang ở trên đầu, tràn ngang là chấp nhận được).

**Danh sách cột cuối cùng** (theo thứ tự này). Cột có bộ lọc sẵn thì **giữ nguyên component lọc** (`ThOrderCode`, `ThDepartureTime`, `ThPartner`, `ThRoute`, `ThCustomerName`, `ThPhone`, `ThSellPrice`, `ThDeposit`, `ThCommission`, `ThStaff`, `ThSms`); cột mới thêm chỉ là tiêu đề thường `<th className={TH}>` (không làm bộ lọc cho cột mới).

| # | Cột | Nguồn | Hiển thị |
|---|---|---|---|
| 1 | STT | chỉ số hàng | như cũ |
| 2 | Mã đơn | `id` | như cũ (giữ huy hiệu "Đã hủy") |
| 3 | Ngày vào sổ | `entryDate` | `formatDateVN`, **cột mới** |
| 4 | Ngày khởi hành | `departureDate` | `formatDateVN`, **cột mới tách ra** (không còn gộp chung với giờ) |
| 5 | Giờ xe | `departureTime` | chỉ hiện giờ `HH:mm` (in đậm xanh như cũ), **không còn dòng ngày bên dưới**; giữ bộ lọc `ThDepartureTime` |
| 6 | Nhà xe | `partner` | như cũ (mặc định `XVIP`) |
| 7 | Tuyến đường | `route.name` | như cũ |
| 8 | Loại hình | `vehicleType` | chữ, rỗng thì `—`, **cột mới** |
| 9 | Điểm đón | `pickupPoint` | cho xuống dòng, rỗng thì `—`, **cột mới** |
| 10 | Điểm trả | `dropoffPoint` | cho xuống dòng, rỗng thì `—`, **cột mới** |
| 11 | Khách hàng | `customerName` | như cũ (cố định rộng, xuống dòng) |
| 12 | Số điện thoại | `phone` | như cũ |
| 13 | Số ghế | `seatCount` | số, **cột mới**; `0` thì hiện `0` |
| 14 | Ghế đầu | `seatFront` | số, **cột mới**; `0` thì hiện `0` |
| 15 | Ghế giữa | `seatMiddle` | số, **cột mới**; `0` thì hiện `0` |
| 16 | Ghế cuối | `seatBack` | số, **cột mới**; `0` thì hiện `0` |
| 17 | Tổng vé | `tickets` | số, **cột mới** |
| 18 | Giá nhập | `costPrice` | `money(...)đ`, căn phải, **cột mới** |
| 19 | Giá bán | `sellPrice` | như cũ |
| 20 | Đã cọc | `deposit` | `money(...)đ`, **0 thì hiện `0đ`** (hiện đã đúng ở Báo cáo, giữ) |
| 21 | Nhờ thu | `collectOnDelivery` | `money(...)đ`, căn phải, **cột mới** |
| 22 | **Doanh số** (đổi tên từ "Hoa hồng") | `commission` | như cũ, chỉ đổi chữ tiêu đề |
| 23 | NV tạo | `staff.fullName` | như cũ |
| 24 | Tin nhắn | `smsSent`, `messageChannel`, `smsSentAt` | như cũ, thêm dòng nhỏ giờ gửi (`formatDateVN`/giờ) khi đã gửi |
| 25 | Ghi chú | `note` | cho xuống dòng, rỗng thì `—`, **cột mới** |
| 26 | Lý do hủy | `cancelReason` | chỉ có giá trị khi vé đã hủy, còn lại `—`, **cột mới** |

Yêu cầu chung:
1. Nhãn tiêu đề dùng đúng chữ đang dùng ở form vé và hộp chi tiết (`OrderDetailModal`): "Giá nhập" (không phải "Giá vốn"), "Nhờ thu" (không phải "Thu hộ"), "Điểm đón", "Điểm trả", "Loại hình".
2. Cột chữ dài (Điểm đón, Điểm trả, Ghi chú, Lý do hủy) đặt chiều rộng cố định khoảng `w-48` và cho xuống dòng (`!whitespace-normal [overflow-wrap:anywhere]`), giống cách ô Khách hàng đang làm, để không làm bảng giãn vô hạn.
3. Cột số ghế/đầu/giữa/cuối căn giữa hoặc phải, dùng `tnum`.
4. Hàng vẫn bấm được để mở `OrderDetailModal` như cũ. Hàng vé đã hủy vẫn mờ như cũ.
5. Không thêm cột Thao tác, không thêm nút nào.
6. **Tách ngày khởi hành và giờ xe thành hai cột riêng**: ô "Giờ xe" hiện tại gộp giờ (`departureTime`) và ngày (`departureDate`) trong cùng một ô hai dòng. Đổi thành cột **Ngày khởi hành** (cột 4) và cột **Giờ xe** (cột 5) riêng, mỗi cột một giá trị, không dòng phụ. Ngày hiển thị bằng `formatDateVN` như cũ. Bộ lọc `ThDepartureTime` (lọc theo giờ) giữ ở cột Giờ xe; cột Ngày khởi hành chỉ là tiêu đề thường (đã có lọc ngày khởi hành ở thanh trên, không thêm lọc mới). Cập nhật `colSpan` theo số cột mới.
7. **Đổi tên cột "Hoa hồng" thành "Doanh số"** trong bảng danh sách đơn ở Báo cáo. Chỉ đổi chữ hiển thị, **giữ nguyên trường dữ liệu `commission`** và tên tham số lọc (`commissions`, `commissionMin`, `commissionMax`, `ThCommission`). Đổi ở mọi chỗ người dùng nhìn thấy của cột này **trong trang Báo cáo**: tiêu đề cột (`ThCommission` trong `frontend/src/features/xvip/OrderColumnFilters.tsx`: tham số `title` của `ThFilter`, `title` của `ColumnFilterPopover` và `CheckListFilter`, placeholder/nhãn trong hộp lọc), chip bộ lọc đang bật (nếu có, ví dụ "Hoa hồng: ..." thành "Doanh số: ..."), tooltip, `aria-label`. Grep `Hoa hồng` trong `OrderColumnFilters.tsx` và `bao-cao/page.tsx` để chắc không sót.
   - `ThCommission` được dùng chung với trang Quản lý vé. Để trang Quản lý vé **vẫn giữ chữ "Hoa hồng"**, cho `ThCommission` nhận thêm prop tùy chọn `title` (mặc định `"Hoa hồng"`), và ở Báo cáo truyền `title="Doanh số"`. Không đổi chữ ở Quản lý vé, Bảng lương, hay các thẻ thống kê (các nơi đó đã có chữ riêng của chúng).

**Kiểm tra (chỉ phía frontend):** `npx tsc --noEmit` trong `frontend`, `npx eslint frontend/src/app/xvip/bao-cao/page.tsx`.

**Tiêu chí hoàn thành:** bảng Báo cáo có đủ 26 cột trên, mỗi cột đúng dữ liệu, cột 22 hiện chữ "Doanh số" (cả tiêu đề, hộp lọc, chip), Quản lý vé vẫn là "Hoa hồng"; các bộ lọc cột cũ vẫn hoạt động; không có cột Thao tác; `colSpan` hai hàng trạng thái khớp số cột mới.

---

## Task 2: Cột Đã cọc hiện `0đ` thay cho "Chưa cọc"

- [x] Đã xong. Đã đổi hiển thị mức cọc 0 từ "Chưa cọc" / "Chưa cọc (0đ)" thành `0đ` ở trang Quản lý vé (ô bảng và chip bộ lọc), OrderColumnFilters (comment), backend orders.service.ts (nhãn columnValues), và orders.column-filter.spec.ts (test assertion). Toàn bộ frontend/src và backend/src không còn chữ "Chưa cọc".

Tìm mọi chỗ hiện chữ "Chưa cọc" (đã biết các chỗ sau, grep thêm `Chưa cọc` trong `frontend/src` và `backend/src` để chắc không sót):

1. `frontend/src/app/xvip/quan-ly-ve/page.tsx` khoảng dòng 1459: ô bảng đang là `t.deposit > 0 ? \`${money(t.deposit)}đ\` : 'Chưa cọc'`. Đổi thành luôn `${money(t.deposit)}đ` (0 thì ra `0đ`).
2. `frontend/src/app/xvip/quan-ly-ve/page.tsx` khoảng dòng 1207: nhãn chip bộ lọc `d === 0 ? 'Chưa cọc (0đ)' : ...`. Đổi thành luôn `${money(d)}đ`.
3. `backend/src/modules/orders/orders.service.ts` hàm `columnValues` khoảng dòng 1340: nhãn mức cọc 0 đang là `'Chưa cọc (0đ)'`, đổi thành `0đ` (cùng định dạng các mức khác).
4. `backend/src/modules/orders/orders.column-filter.spec.ts` khoảng dòng 248-260: cập nhật test (tên test và nhãn mong đợi) cho khớp `0đ`.
5. `frontend/src/features/xvip/OrderColumnFilters.tsx` khoảng dòng 688: sửa comment mô tả cột Đã cọc cho khớp (không còn chữ "Chưa cọc"). Nếu component hiển thị `label` lấy từ API thì tự đúng.
6. Trang Báo cáo: ô bảng đã là `0đ`, chỉ cần kiểm tra không còn chỗ nào khác hiện chữ "Chưa cọc".

**Kiểm tra:** `npx tsc --noEmit` ở `frontend`, `npx vitest run orders.column-filter` ở `backend`.

**Tiêu chí hoàn thành:** grep `Chưa cọc` trong `frontend/src` và `backend/src` không còn kết quả; vé chưa cọc hiện `0đ` ở cả hai trang, kể cả trong danh sách tick của bộ lọc cột Đã cọc.

---

## Task 3: Kiểm tra tổng (chạy một lần)

- [x] Đã hoàn thành kiểm tra tổng

1. `npx tsc --noEmit` trong `frontend` và `backend`.
2. `npx eslint` các file đã sửa.
3. `npx vitest run` toàn bộ backend (66 test, phải vẫn qua).
4. Ghi kết quả vào mục dưới, kèm danh sách mọi việc **ngoài** danh sách task mà bạn thấy cần nhưng chưa làm.

**Kết quả:**

- `frontend`: `npx tsc --noEmit` chạy sạch, **0 lỗi**.
- `backend`: `npx tsc --noEmit` không có lỗi trong `src/` (chỉ có 1 lỗi TS2307 có sẵn ở `test/app.e2e-spec.ts` về `supertest/types` đúng như mô tả).
- `frontend`: `npx eslint src/app/xvip/bao-cao/page.tsx src/features/xvip/OrderColumnFilters.tsx src/app/xvip/quan-ly-ve/page.tsx` sạch, **0 lỗi, 0 cảnh báo**.
- `backend`: `npx vitest run` toàn bộ test: **11/11 file passed, 66/66 tests passed**.
- Kiểm tra toàn bộ `frontend/src` và `backend/src`: **0 kết quả** chứa chữ "Chưa cọc" / "chua coc".
- Danh sách việc ngoài task: Không phát sinh việc nào ngoài danh sách cần làm. Tất cả 26 cột và logic hiển thị `0đ` đều hoạt động ổn định và nhất quán.
