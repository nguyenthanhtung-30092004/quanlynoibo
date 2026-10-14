# TASKS cho Antigravity: trang Quản lý vé (danh sách vé)

Làm lần lượt Task A rồi Task B (B dựa trên bảng đã gọn của A). Xong task nào thì đổi `[ ]` thành `[x]` và ghi 1-2 dòng đã sửa gì. Không commit, không push, không chạy server.

**Cách chạy lệnh:** dùng **PowerShell trên Windows**, không dùng WSL. Kiểm tra kiểu bằng `npx tsc --noEmit` trong `frontend` và `backend` (backend có sẵn 1 lỗi cũ ở `test/app.e2e-spec.ts` về `supertest/types`, bỏ qua). Lint frontend: `npx eslint <file>`. Test backend: `npx vitest run <tên file>` trong `backend` (dự án dùng **vitest**, không phải jest).

## Bối cảnh

File chính: `frontend/src/app/xvip/quan-ly-ve/page.tsx` (khoảng 1900 dòng). Bảng danh sách vé nằm ở khoảng dòng 1055-1260, hiện có **12 cột**: STT, Mã đơn, Giờ xe, Nhà xe, Tuyến đường, Khách hàng, Số điện thoại, Giá bán, Hoa hồng, NV tạo, Tin nhắn, Thao tác.

Vấn đề: màn 27 inch hiển thị đủ, nhưng laptop (1366-1440px) bị tràn, phải kéo ngang, không nhìn tổng quát được. Chủ muốn (1) thiết kế bảng gọn lại và (2) có bộ lọc kiểu Excel ở đầu từng cột.

Danh sách vé **phân trang ở server** (`GET /orders`, `findAll` trong `backend/src/modules/orders/orders.service.ts`, bộ lọc dựng ở `buildListQuery` khoảng dòng 1195). Vì vậy lọc theo cột **phải làm ở server**, không được chỉ lọc trong trang đang hiển thị. `buildListQuery` cũng được dùng cho xuất Excel (`GET /orders/export`) nên bộ lọc cột mới sẽ tự có hiệu lực khi xuất Excel; giữ đúng như vậy.

Không đổi logic nghiệp vụ khác (tạo/sửa/hủy/xóa vé, tin nhắn, KPI, công nợ).

---

## Task A: Thiết kế lại bảng cho gọn (vừa laptop)

- [x] Đã hoàn thành: Gộp bảng từ 12 cột thành 8 cột (2 dòng/ô), đổi 5 nút thao tác thành icon gọn (Repeat, ClockCounterClockwise, PencilSimple, XCircle, Trash), ghim cố định STT (sticky left) và Thao tác (sticky right) kèm bóng mờ và màu nền chuẩn sáng/tối. Cập nhật colSpan=8.

**File:** `frontend/src/app/xvip/quan-ly-ve/page.tsx` (hằng `TH`, `TD`, `NUM` và khối `<table>`).

**Yêu cầu**
1. Gộp cột để còn **8 cột**, mỗi ô gộp là hai dòng (dòng trên chữ đậm, dòng dưới chữ nhỏ xám):
   - `STT`
   - `Đơn / Giờ xe`: dòng trên mã đơn (`XV123`, giữ huy hiệu "Đã hủy"), dòng dưới giờ xe + ngày (ví dụ `08:30 · 15/10/2026`).
   - `Nhà xe / Tuyến`: dòng trên nhà xe (mặc định `XVIP` như hiện tại), dòng dưới tên tuyến.
   - `Khách hàng`: dòng trên tên (mặc định `Khách lẻ`), dòng dưới số điện thoại (font số `tnum`).
   - `Giá bán / Hoa hồng`: căn phải; dòng trên giá bán, dòng dưới hoa hồng màu đỏ như hiện tại.
   - `NV tạo`
   - `Tin nhắn`
   - `Thao tác`
2. Cột `Thao tác`: hiện 5 nút chữ ("Đặt lại", "Lịch sử", "Sửa", "Hủy", xóa) rất rộng. Đổi thành **nút icon** (giữ icon phosphor hiện có, có `title` tooltip như cũ), xếp một hàng gọn. Không đổi chức năng và quyền (nút Xóa vẫn chỉ Admin, Sửa/Hủy ẩn khi đã hủy).
3. Cột `STT` và `Thao tác` **dính cố định** (`sticky left-0` / `sticky right-0`, có nền đặc đúng màu hàng và hover, có viền/bóng mờ phân cách) để khi bảng vẫn phải kéo ngang ở màn hẹp, hai cột này luôn thấy. Bao bảng bằng `overflow-x-auto` như hiện tại; chỉ màn rất hẹp (dưới ~1100px) mới cần kéo.
4. Giảm padding ngang của `TH`/`TD` một chút, nhưng giữ chữ đủ lớn để đọc (không nhỏ hơn mức hiện tại ở dòng chính). Cho phép xuống dòng ở tên khách, tên tuyến (`break-words`), không cắt bằng dấu "...".
5. Hàng bấm vào vẫn mở chi tiết (`setDetailOrder`), các nút ở cột Thao tác vẫn `stopPropagation`. Hàng đã hủy vẫn mờ như cũ. Cập nhật `colSpan` của các hàng "Đang tải" và "Chưa có đơn" cho khớp số cột mới.
6. Kiểm tra cả giao diện sáng và tối (có lớp `dark:`).

**Tiêu chí hoàn thành:** ở bề rộng 1366px không còn thanh kéo ngang (hoặc chỉ còn khi dữ liệu rất dài); mọi thông tin cũ vẫn còn trong ô gộp; các nút thao tác dùng được như trước; `tsc` và eslint không thêm lỗi mới.

---

## Task B: Lọc kiểu Excel ở đầu từng cột

- [x] Đã hoàn thành: Bổ sung bộ lọc cột ở DTO & buildListQuery (hỗ trợ customerNames, phones, staffIds, departureTimes, smsStatus, khoảng giá/hoa hồng, orderCode), endpoint `GET /orders/column-values`; tạo component `ColumnFilter.tsx`, thanh chip bộ lọc đang bật, gộp đồng bộ bộ lọc thanh trên với bộ lọc cột và xuất Excel. Thêm unit test vitest cho backend.

### B1. Backend: thêm bộ lọc cột và API lấy giá trị

**File:** `backend/src/modules/orders/dto/query-orders.dto.ts` (`OrderFilterDto`), `backend/src/modules/orders/orders.service.ts` (`buildListQuery`), `backend/src/modules/orders/orders.controller.ts`.

1. Thêm các tham số tùy chọn vào `OrderFilterDto` (dùng chung cho danh sách và xuất Excel). Dạng danh sách là chuỗi cách nhau bằng dấu phẩy, theo đúng mẫu `partners` đang có (`@Transform` tách chuỗi, `@ArrayMaxSize(200)`, `@MaxLength(100, { each: true })`):
   - `customerNames: string[]` (khớp **đúng** tên, không phân biệt hoa thường; tên rỗng/`Khách lẻ` xử lý ở điểm 3)
   - `phones: string[]` (khớp đúng SĐT)
   - `staffIds: number[]` (nhiều nhân viên; chỉ có tác dụng với Admin, nhân viên thường bỏ qua như `staffId`)
   - `departureTimes: string[]` (giờ xe `HH:mm`, regex kiểm tra)
   - `smsStatus: 'sent' | 'unsent'` (tin nhắn đã gửi / chưa gửi)
   - `sellPriceMin`, `sellPriceMax`, `commissionMin`, `commissionMax`: số nguyên không âm
   - `orderCode: string` (gõ `XV116` hoặc `116`, khớp đúng id)
2. Các tham số có sẵn dùng lại, không tạo trùng: nhiều tuyến = `routeIds`, nhiều nhà xe = `partners`, ngày khởi hành = `departureFrom`/`departureTo`.
3. Trong `buildListQuery` thêm điều kiện tương ứng bằng tham số hóa (`:name`), **không nối chuỗi SQL**. Khách lẻ: nếu danh sách `customerNames` có giá trị `Khách lẻ` thì khớp thêm các đơn `customerName IS NULL OR customerName = ''`. Các điều kiện kết hợp bằng AND với nhau và với bộ lọc ngày/tuyến/đối tác hiện có.
4. Thêm endpoint `GET /orders/column-values` (khai báo **trước** `@Get(':id')`, cạnh `kpi/filter-options`): query gồm `column` (`customer` | `phone` | `staff` | `route` | `partner` | `departureTime`), `q` (từ khóa tìm trong giá trị, tùy chọn, tối đa 100 ký tự) và **toàn bộ bộ lọc hiện hành** (dùng `OrderFilterDto`) **trừ chính cột đang mở** (frontend sẽ tự bỏ tham số của cột đó khi gọi, giống Excel: danh sách giá trị của cột hiện các giá trị còn lại sau khi áp các bộ lọc cột khác). Trả về tối đa 100 giá trị `{ value, label, count }` sắp theo `count` giảm dần rồi theo chữ cái. Dùng `GROUP BY` trên cùng `buildListQuery` để tôn trọng quyền (nhân viên chỉ thấy giá trị của vé mình, trừ khi đang tìm kiếm như `buildListQuery` đã quy định).
5. Viết test vitest (`orders.service` hoặc file spec mới cùng thư mục) cho: lọc nhiều khách, Khách lẻ khớp tên rỗng, khoảng giá, kết hợp nhiều cột, nhân viên thường không đọc được vé người khác qua `staffIds` / `column-values`.

### B2. Frontend: ô lọc ở tiêu đề cột

**File:** `frontend/src/app/xvip/quan-ly-ve/page.tsx`, tạo component mới `frontend/src/features/xvip/ColumnFilter.tsx`; kiểu `OrderFilters` ở `frontend/src/features/orders/types.ts`; `frontend/src/features/orders/api.ts` và `hooks.ts` (thêm hook gọi `column-values`, tham số lọc mới phải được chuyển thành query string cho cả `GET /orders` và `GET /orders/export`).

1. Mỗi tiêu đề cột (trừ STT và Thao tác) có biểu tượng **phễu** nhỏ bên cạnh tên. Bấm vào mở một khung nổi (popover) dưới tiêu đề; bấm ra ngoài hoặc phím `Esc` thì đóng. Cột đang có lọc thì phễu tô màu xanh và có chấm báo, để nhìn bảng biết cột nào đang lọc.
2. Có ba kiểu khung lọc:
   - **Tick chọn** (Nhà xe, Tuyến, Khách hàng, NV tạo, Giờ xe, Tin nhắn): ô gõ tìm ở đầu (gõ có debounce ~300ms thì gọi `column-values` với `q`), danh sách ô tick kèm số vé `(12)`, nút "Chọn tất cả kết quả đang hiện" và "Bỏ chọn tất cả", nút "Áp dụng" và "Xóa lọc cột này". Cột Tin nhắn chỉ có hai lựa chọn cố định "Đã gửi" / "Chưa gửi" (không cần gọi API).
   - **Khoảng số** (Giá bán, Hoa hồng): hai ô "Từ" / "Đến" dùng `MoneyInput` (đã có ở `@/features/payroll/MoneyInput`), cho bỏ trống một đầu.
   - **Ô gõ** (Mã đơn): gõ `XV116` hoặc `116`.
   - Cột gộp: ô lọc **Khách hàng** áp dụng cho cả tên và SĐT. Trong khung tick, mỗi dòng hiện `Tên · SĐT`; gõ tìm khớp cả tên lẫn số. Chọn một dòng thì lọc theo cặp đó (gửi `customerNames` và/hoặc `phones` tương ứng). Ô lọc **Đơn / Giờ xe**: hai phần trong cùng khung, phần Mã đơn và phần Giờ xe. Ô lọc **Giá bán / Hoa hồng**: hai khoảng trong cùng khung. Ô lọc **Nhà xe / Tuyến**: hai danh sách tick trong cùng khung (tab hoặc hai khối xếp dọc).
3. **Gộp với bộ lọc phía trên**: các ô lọc nhanh đang có ở thanh trên (nhân viên, tuyến nhiều lựa chọn, đối tác) và lọc theo cột phải **dùng chung một trạng thái** (`routeIds`, `partners`/`partner`, `staffId`/`staffIds`) để chọn ở nơi này thì nơi kia hiện đúng và không lệch. Nếu phức tạp, chấp nhận giữ thanh trên là nguồn chính và khung cột chỉ đọc/ghi cùng các trường đó.
4. Mọi thay đổi bộ lọc cột **đưa trang về 1** (`page: 1`), giống các bộ lọc khác. Khi ô tìm kiếm tổng (`search`) đang bật thì bảng đã bỏ qua các bộ lọc khác (xem `searching` ở khoảng dòng 321); giữ nguyên quy ước đó và hiện dòng nhắc nhỏ "Đang tìm kiếm: bộ lọc cột tạm không áp dụng".
5. Thêm dải **chip bộ lọc đang bật** phía trên bảng (ví dụ `Khách: Nguyễn Văn A ×`, `Giá bán: 500.000 - 1.000.000 ×`) kèm nút "Xóa tất cả bộ lọc cột". Bấm × gỡ đúng bộ lọc đó.
6. Hook lấy `column-values` chỉ chạy khi popover mở (`enabled`), có `keepPreviousData`/`placeholderData` để danh sách không nhấp nháy khi gõ tìm; hủy request cũ khi gõ tiếp (đã có `signal` ở các hook khác, làm theo).
7. Xuất Excel (`ordersApi.exportExcel(filters)`) phải gửi **cả bộ lọc cột mới** để file khớp đúng danh sách đang xem. Kiểm tra hàm xây query string của `exportExcel` và `list` dùng chung một chỗ.
8. Giao diện sáng/tối, thao tác bằng bàn phím được (Tab tới nút phễu, Enter mở, Esc đóng), popover không tràn ra ngoài màn hình (cột cuối mở sang trái).

**Tiêu chí hoàn thành**
- Lọc theo từng cột trả đúng số vé từ server (tổng số vé và phân trang đúng sau khi lọc), không chỉ lọc trong trang hiện tại.
- Tick nhiều giá trị trong một cột là OR; nhiều cột cùng lọc là AND.
- Danh sách giá trị trong khung lọc phản ánh các bộ lọc cột còn lại.
- Xuất Excel ra đúng tập vé đang lọc.
- Nhân viên thường không thấy giá trị hay vé của người khác qua bộ lọc mới.
- Chip bộ lọc, nút xóa lọc hoạt động; chuyển trang giữ nguyên bộ lọc.
- `tsc` hai bên, eslint các file đã sửa, test vitest mới không thêm lỗi.

---

## Ghi chú cho người làm

- Đừng thay đổi cột `Tin nhắn`/`Thao tác` về chức năng, chỉ đổi cách hiển thị (Task A).
- Chủ thường xem bằng cả màn 27 inch và laptop; kiểm tra bố cục ở 1366px, 1440px và 1920px.
- Nếu thấy việc gộp Nhà xe/Tuyến hay Giá bán/Hoa hồng làm khó lọc theo từng giá trị riêng, giữ lọc **riêng từng giá trị** trong cùng một khung popover như mô tả ở B2.2, đừng bỏ lọc cột nào.
