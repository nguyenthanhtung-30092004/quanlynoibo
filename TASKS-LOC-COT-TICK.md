# TASKS cho Antigravity: lọc cột kiểu Excel (tick từng giá trị) ở Báo cáo và Quản lý vé

Làm lần lượt từng task. Xong task nào thì đổi `[ ]` thành `[x]` và ghi 1-2 dòng đã sửa gì. Không commit, không push, không chạy server.

**Cách chạy lệnh:** dùng **PowerShell trên Windows**, không dùng WSL. Kiểm tra kiểu bằng `npx tsc --noEmit` trong `frontend` và `backend` (backend có sẵn 1 lỗi cũ ở `test/app.e2e-spec.ts` về `supertest/types`, bỏ qua). Lint: `npx eslint <file>` ở frontend. Test backend: `npx vitest run <tên file>` trong `backend` (dùng **vitest**, không phải jest).

## Bối cảnh

Hộp lọc ở tiêu đề cột đã có (component `frontend/src/features/xvip/OrderColumnFilters.tsx`, dùng ở `frontend/src/app/xvip/bao-cao/page.tsx` và `frontend/src/app/xvip/quan-ly-ve/page.tsx`; API `GET /orders/column-values` ở `backend/src/modules/orders/orders.service.ts` hàm `columnValues`, hook `useColumnValues` ở `frontend/src/features/orders/hooks.ts`). Mẫu chuẩn là bộ lọc cột **Tuyến đường**: mở hộp ra thấy **mỗi giá trị đang có trong dữ liệu là một ô tích kèm số vé**, tích nhiều ô rồi bấm Áp dụng, đúng như Excel.

Chủ yêu cầu: các cột còn lại cũng phải làm **y như vậy**: *có bao nhiêu giá trị thì hiện bấy nhiêu ô tích*. Rà soát hiện trạng cho thấy:

| Cột | Hiện tại | Cần |
|---|---|---|
| Đã cọc | chỉ một ô tích "Chỉ đơn khách đã cọc" (`depositOnly`) | liệt kê từng mức cọc đang có, mỗi mức một ô tích |
| Giá bán | chỉ ô nhập khoảng Từ-Đến | liệt kê từng mức giá đang có, mỗi mức một ô tích (giữ thêm khoảng Từ-Đến ở dưới) |
| Hoa hồng | chỉ ô nhập khoảng Từ-Đến | như Giá bán |
| Nhà xe | hộp hiện nhiều ô tích nhưng **chỉ áp dụng giá trị đầu tiên** (`partners[0]`) | tích nhiều nhà xe, lọc đúng tất cả đã tích |
| NV tạo | hộp hiện nhiều ô tích nhưng **chỉ áp dụng giá trị đầu tiên** (`Number(ids[0])`) | tích nhiều nhân viên, lọc đúng tất cả |
| Tin nhắn | hai ô "Đã gửi" / "Chưa gửi", tích cả hai thì coi như không lọc | ba ô: "Đã gửi SMS", "Đã gửi Zalo", "Chưa gửi", chọn được tổ hợp bất kỳ |
| Tuyến, Giờ xe, Khách hàng/SĐT | đã là danh sách tick | giữ nguyên |
| Mã đơn | ô gõ | giữ nguyên (mỗi đơn một mã duy nhất, không hợp tick) |

Quy ước lọc không đổi: tick nhiều giá trị trong **một cột** là OR; nhiều cột cùng lọc là AND. Danh sách giá trị của một cột phản ánh các bộ lọc **các cột khác** (bỏ tham số của chính cột đó khi gọi `column-values`), như mọi hộp lọc hiện có.

Thẻ "Đã cọc xvip" ở đầu trang Báo cáo vẫn bấm để bật/tắt `depositOnly` (đơn có cọc > 0) và dùng chung trạng thái với cột Đã cọc, giữ như hiện tại.

---

## Task 1: Cột Đã cọc, Giá bán, Hoa hồng thành danh sách tick từng mức

- [x] Đã hoàn thành
  - Backend: OrderFilterDto, buildListQuery, columnValues thêm lọc deposits, sellPrices, commissions (nhãn tiền tệ vi-VN, mức cọc 0đ hiện "Chưa cọc (0đ)", sắp tăng dần); bổ sung 4 unit test vitest kiểm tra lọc và quyền nhân viên.
  - Frontend: Thêm 3 tham số vào types, api, hooks; viết lại ThDeposit, ThSellPrice, ThCommission với danh sách tick CheckListFilter kết hợp NumberRangeFilter cho Giá bán / Hoa hồng; thêm chip bộ lọc ở Quản lý vé.

### Backend

**File:** `backend/src/modules/orders/dto/query-orders.dto.ts`, `orders.service.ts` (`buildListQuery`, `columnValues`), `orders.controller.ts` (kiểu của tham số `column`).

1. `OrderFilterDto` thêm 3 tham số tùy chọn, dạng chuỗi số cách nhau bằng dấu phẩy, theo đúng mẫu `routeIds` (`@Transform` tách chuỗi, `@IsArray`, `@ArrayMaxSize(200)`, `@IsInt({ each: true })`, `@Min(0, { each: true })`):
   - `deposits: number[]` (các mức tiền cọc)
   - `sellPrices: number[]` (các mức giá bán)
   - `commissions: number[]` (các mức hoa hồng)
2. `buildListQuery` thêm điều kiện `order.deposit IN (:...deposits)`, `order.sellPrice IN (:...sellPrices)`, `order.commission IN (:...commissions)`, tham số hóa. Kết hợp AND với mọi bộ lọc khác, **kể cả** `depositOnly`, khoảng `sellPriceMin/Max`, `commissionMin/Max` đã có (không bỏ các tham số cũ).
3. `columnValues` thêm 3 giá trị `column`: `deposit`, `sellPrice`, `commission`. Mỗi giá trị trả danh sách mức khác nhau của cột đó trong tập vé đang lọc: `GROUP BY` cột, `value` là chuỗi số, `label` là số tiền định dạng `1.250.000đ` (mức 0 của cột Đã cọc có `label` là `Chưa cọc (0đ)`), `count` là số vé. Sắp theo **giá trị tăng dần** (khác các cột kia sắp theo số vé), tối đa 100 giá trị. Tham số `q` lọc theo chuỗi số (người dùng gõ `500` ra các mức chứa `500`): so khớp `CAST(cột AS text) LIKE :valQ` (escape ký tự LIKE bằng `escapeLike` có sẵn).
4. Cập nhật kiểu `column` ở controller và DTO validate (nếu có `@IsIn`) để nhận 3 giá trị mới.
5. Test vitest (file `orders.column-filter.spec.ts` hoặc spec cạnh nó): lọc `deposits=0` ra đơn chưa cọc, `deposits=200000,500000` là OR, kết hợp với `sellPrices` là AND, `columnValues('deposit')` sắp tăng dần và có mức 0, nhân viên thường không thấy giá trị của vé người khác.

### Frontend

**File:** `frontend/src/features/orders/types.ts` (`OrderFilters`, kiểu `column` của `useColumnValues`), `api.ts` (đưa 3 tham số mới vào query string của **cả** `GET /orders` và `GET /orders/export` và `column-values`, giống `routeIds`), `hooks.ts`, `frontend/src/features/xvip/OrderColumnFilters.tsx`.

1. Viết lại `ThDeposit`, `ThSellPrice`, `ThCommission` theo mẫu `ThRoute` / `RouteFilterInner`: một component `…FilterInner` gọi `useColumnValues('deposit' | 'sellPrice' | 'commission', filtersBỏThamSốCủaChínhCột, debouncedSearch)`, hiển thị bằng `CheckListFilter` (ô tìm, danh sách tick kèm số vé, "Chọn tất cả kết quả đang hiện", "Bỏ chọn tất cả", Áp dụng, Xóa lọc cột).
   - Bỏ tham số của chính cột khi lấy danh sách: `{ ...filters, deposits: undefined }` (và tương tự).
2. Cột Giá bán và Hoa hồng **giữ thêm khối "Hoặc theo khoảng: Từ - Đến"** (`NumberRangeFilter` có sẵn) bên dưới danh sách tick, trong cùng một hộp, vì giá có thể thay đổi liên tục. Hai kiểu lọc (tick và khoảng) áp dụng cùng lúc theo AND.
3. Cột Đã cọc: bỏ ô tích "Chỉ đơn khách đã cọc" ra khỏi hộp (chức năng này đã có ở thẻ "Đã cọc xvip" trên đầu trang). Hộp chỉ còn danh sách mức cọc (mức 0 hiện là "Chưa cọc"). Khi `depositOnly` đang bật từ thẻ trên cùng thì hộp này vẫn mở bình thường và danh sách mức cọc tự không còn mức 0 (vì đã bị lọc), không cần xử lý riêng.
4. Trạng thái "đang lọc" (`isActive`) của ba cột gồm cả `deposits.length`, `sellPrices.length`, `commissions.length` và các trường khoảng. `onClear` xóa cả hai kiểu lọc của cột đó.
5. Chip "bộ lọc đang bật" (nếu trang đã có dải chip, ví dụ ở `quan-ly-ve/page.tsx`) thêm chip cho 3 bộ lọc mới: `Giá bán: 500.000đ, 600.000đ ×`. Đổi bộ lọc nào cũng đưa `page` về 1.
6. Xuất Excel (`ordersApi.exportExcel(filters)`) phải gửi cả 3 tham số mới để file khớp danh sách đang xem.

**Tiêu chí hoàn thành:** mở cột Đã cọc / Giá bán / Hoa hồng thấy từng mức đang có (đúng số vé, sắp tăng dần), tích nhiều mức ra đúng vé từ server (kể cả phân trang), danh sách phản ánh các lọc cột khác, xuất Excel khớp; `tsc` hai bên, eslint, test vitest không thêm lỗi mới.

---

## Task 2: Nhà xe và NV tạo cho tích nhiều giá trị

- [x] Đã hoàn thành
  - Backend: Hỗ trợ staffIds trong KpiQueryDto/kpiOrders, xử lý lọc partners/partner cho đơn XVIP (match null/rỗng/'xvip'), bổ sung unit test vitest cho staffIds và multi-partner.
  - Frontend: ThPartner và ThStaff chuyển sang multi-select (partners: string[], staffIds: number[]), đồng bộ 2 chiều với thanh lọc nhanh (OptionFilterInput hỗ trợ customLabel hiển thị 'N đã chọn'), cập nhật useKpi, dải chip và xuất Excel.

**File:** `frontend/src/features/xvip/OrderColumnFilters.tsx` (`ThPartner`, `ThStaff`), `frontend/src/app/xvip/bao-cao/page.tsx` và `frontend/src/app/xvip/quan-ly-ve/page.tsx` (nơi nối trạng thái), `frontend/src/features/orders/types.ts`. Backend đã có sẵn `partners` (danh sách tên) và `staffIds` (danh sách id) trong `OrderFilterDto` và `buildListQuery`; **kiểm tra** `staffIds` đã được xử lý trong `buildListQuery` (chỉ Admin có tác dụng, nhân viên thường bị bỏ qua như `staffId`), chưa có thì thêm `order.createdById IN (:...staffIds)` và test.

**Yêu cầu**
1. `ThPartner`: hiện chỉ lấy `partners[0]` qua trường `partner`. Đổi thành chọn **nhiều** nhà xe, ghi vào `partners: string[]` (rỗng = không lọc). `selected` đọc từ `partners` (nếu còn `partner` cũ từ thanh lọc phía trên thì gộp vào, không để hai nơi lệch nhau). Tick nhiều nhà xe là OR.
2. `ThStaff`: đổi từ `staffId` (một người) sang `staffIds: number[]` (nhiều người), Áp dụng ghi toàn bộ id đã tích. Chỉ Admin thấy biểu tượng lọc như hiện tại.
3. **Đồng bộ với ô lọc nhanh trên thanh phía trên** của hai trang (nhân viên, đối tác, tuyến): hai nơi phải dùng chung một trạng thái để chọn ở nơi này thì nơi kia hiện đúng. Ở trang Báo cáo, `staffFilter` / `partnerNames` / `routeIds` (khoảng dòng 81-180) đang gộp với `colFilters`: gộp thêm `staffIds` và `partners` đúng cách (hợp của hai nguồn, không để cái này ghi đè cái kia). Ở trang Quản lý vé làm tương tự với `localFilters`. Nếu ô lọc nhanh trên thanh chỉ chọn được một giá trị thì cho nó hiển thị "N đã chọn" khi cột đang chọn nhiều giá trị, đừng hiện sai.
4. Các nơi đọc `partner` / `staffId` cũ (xuất Excel, chip bộ lọc, KPI) chuyển sang đọc đúng trường mới hoặc đọc cả hai.

**Tiêu chí hoàn thành:** tích 2-3 nhà xe (hoặc nhân viên) ra đúng số vé của cả nhóm; bỏ tích thì bỏ; thanh lọc nhanh phía trên không hiển thị sai; chuyển trang giữ nguyên; xuất Excel đúng; `tsc`, eslint không thêm lỗi mới.

---

## Task 3: Cột Tin nhắn chọn được tổ hợp SMS / Zalo / Chưa gửi

- [x] Đã hoàn thành
  - Backend: Thêm messageStates vào OrderFilterDto/buildListQuery (OR giữa các trạng thái tin nhắn sms, zalo, unsent; AND với smsStatus), thêm column 'message' vào columnValues trả về 3 trạng thái cố định kèm count (kể cả count = 0); bổ sung 5 vitest unit test.
  - Frontend: Thêm messageStates vào types/api/hooks; viết SmsFilterInner và ThSms với 3 checkbox có count từ API columnValues; đồng bộ dải chip và nút xóa tất cả bộ lọc.

**File:** `backend/src/modules/orders/dto/query-orders.dto.ts`, `orders.service.ts` (`buildListQuery`), `frontend/src/features/xvip/OrderColumnFilters.tsx` (`ThSms`), `frontend/src/features/orders/types.ts`, `api.ts`.

Hiện `smsStatus` chỉ nhận `'sent' | 'unsent'`, và hộp lọc coi "tích cả hai" là không lọc.

**Yêu cầu**
1. Thêm tham số `messageStates` (danh sách, cách nhau dấu phẩy), mỗi giá trị thuộc `sms` | `zalo` | `unsent`:
   - `sms`: `smsSent = true` và `messageChannel` là SMS (hoặc `NULL` với dữ liệu cũ đã gửi nhưng chưa ghi kênh; kiểm tra enum `MessageChannel` ở `entities/order.entity.ts` và cách `ordersList` hiển thị "Đã gửi SMS" để khớp đúng)
   - `zalo`: `smsSent = true` và `messageChannel = 'ZALO'`
   - `unsent`: `smsSent = false`
   Điều kiện giữa các giá trị là OR.
2. Giữ `smsStatus` cũ (`sent` / `unsent`) để không phá chỗ khác đang gọi; nếu cả hai cùng có thì AND.
3. Hộp `ThSms` hiện **ba ô tích** "Đã gửi SMS", "Đã gửi Zalo", "Chưa gửi", mỗi ô kèm số vé (lấy bằng cách thêm `column: 'message'` vào `columnValues`, trả đúng ba giá trị cố định với `count`, kể cả khi `count` bằng 0). Tích tổ hợp nào lọc đúng tổ hợp đó.
4. Test vitest: lọc từng giá trị và tổ hợp `sms,unsent`.

**Tiêu chí hoàn thành:** số vé của từng ô khớp bảng; tích tổ hợp ra đúng vé; xuất Excel khớp; `tsc`, eslint, test không thêm lỗi mới.

---

## Task 4: Rà soát toàn bộ cột và kiểm tra tổng

- [x] Đã hoàn thành
  - Rà soát toàn bộ các cột trên 2 trang Báo cáo và Quản lý vé: bổ sung cột Đã cọc (ThDeposit) vào Quản lý vé để đồng bộ 100% với Báo cáo; mở rộng useEffect tự động dọn dẹp staffIds, partners, deposits, sellPrices, commissions khi đổi khoảng ngày.
  - Toàn bộ test vitest backend (66/66 test passed), frontend tsc (0 lỗi), backend tsc (chỉ còn 1 lỗi cũ test/app.e2e-spec.ts bỏ qua), eslint (0 lỗi) đều đạt chuẩn.

1. Đọc lại `bao-cao/page.tsx` và `quan-ly-ve/page.tsx`: liệt kê mọi cột của bảng danh sách đơn và ghi vào file này (mục dưới) cột nào đã là danh sách tick, cột nào còn ô gõ hoặc khoảng. Cột nào còn ít giá trị lặp lại mà chưa phải danh sách tick thì sửa nốt theo mẫu ở trên (không làm cột có giá trị duy nhất từng dòng như Mã đơn).
2. Kiểm tra: chọn ở hộp cột rồi xóa bằng chip / nút "Xóa lọc" / thẻ "Đã cọc xvip" / thanh lọc phía trên đều trả trạng thái về đúng; đổi khoảng ngày thì các lựa chọn không còn hợp lệ được dọn (như `useEffect` dọn `staffId`/`routeIds` ở đầu hai trang, mở rộng cho `staffIds`, `partners`, `deposits`, `sellPrices`, `commissions`).
3. Chạy `tsc` hai bên, `npx eslint` các file đã sửa, `npx vitest run` toàn bộ backend. Ghi kết quả vào đây.

**Kết quả rà soát (Antigravity điền):**

### 1. Bảng hiện trạng các cột sau khi chuẩn hóa

| STT | Tên cột | Component bộ lọc | Kiểu lọc | Trạng thái & ghi chú |
|---|---|---|---|---|
| 1 | STT | Không có | Không lọc | Cột số thứ tự dòng |
| 2 | Mã đơn | `ThOrderCode` | Ô gõ text | Tìm theo mã đơn (ví dụ `XV123` hoặc `123`). Giá trị duy nhất từng dòng, giữ ô gõ. |
| 3 | Giờ xe | `ThDepartureTime` | Danh sách tick | `CheckListFilter<string>`, lấy từ API `columnValues('departureTime')`, có ô tìm kiếm, chọn/bỏ tất cả. |
| 4 | Nhà xe | `ThPartner` | Danh sách tick (nhiều lựa chọn) | `CheckListFilter<string>`, hỗ trợ XVIP và các nhà xe, tick nhiều nhà xe (OR), đồng bộ 2 chiều với thanh lọc nhanh. |
| 5 | Tuyến đường | `ThRoute` | Danh sách tick (nhiều lựa chọn) | `CheckListFilter<number>`, tick nhiều tuyến (OR), đồng bộ 2 chiều với thanh lọc nhanh. |
| 6 | Khách hàng | `ThCustomer` | Danh sách tick | `CheckListFilter<string>`, lấy từ API `columnValues('customer')`, có ô tìm kiếm. |
| 7 | Số điện thoại | `ThCustomer` | Danh sách tick | `CheckListFilter<string>`, lấy từ API `columnValues('phone')`, có ô tìm kiếm. |
| 8 | Giá bán | `ThSellPrice` | Danh sách tick + khoảng Từ-Đến | Liệt kê từng mức giá có trong dữ liệu (sắp tăng dần, định dạng tiền tệ `xxx.xxxđ`), kết hợp khối Từ-Đến (`NumberRangeFilter`). |
| 9 | Đã cọc | `ThDeposit` | Danh sách tick | Liệt kê từng mức cọc (mức 0đ nhãn "Chưa cọc (0đ)", sắp tăng dần). Đã bổ sung hiển thị cột và popover đồng bộ cả ở `Quản lý vé` và `Báo cáo`. |
| 10 | Hoa hồng | `ThCommission` | Danh sách tick + khoảng Từ-Đến | Liệt kê từng mức hoa hồng có trong dữ liệu (sắp tăng dần, định dạng tiền tệ), kết hợp khối Từ-Đến (`NumberRangeFilter`). |
| 11 | NV tạo | `ThStaff` | Danh sách tick (nhiều lựa chọn) | `CheckListFilter<number>`, chỉ Admin thấy biểu tượng lọc, chọn nhiều nhân viên (OR), đồng bộ 2 chiều với thanh lọc nhanh. |
| 12 | Tin nhắn | `ThSms` | Danh sách tick (3 trạng thái) | 3 ô tick cố định kèm số lượng vé: "Đã gửi SMS", "Đã gửi Zalo", "Chưa gửi". Chọn tổ hợp bất kỳ (OR giữa các trạng thái). |
| 13 | Thao tác | Không có | Không lọc | Cột nút thao tác (chỉ có ở Quản lý vé). |

### 2. Kiểm tra tương tác, xóa lọc và dọn dẹp khi đổi khoảng ngày

- **Xóa lọc đơn lẻ**: Bấm nút "Xóa lọc" trong popover hoặc bấm dấu `×` trên dải chip bộ lọc: giá trị của cột đó được xóa sạch, bảng cập nhật ngay lập tức và đưa trang về 1.
- **Xóa tất cả bộ lọc cột** (nút màu đỏ trên dải chip trang Quản lý vé): xóa toàn bộ các bộ lọc cột (`orderCode`, `departureTimes`, `partner`, `partners`, `routeIds`, `customerNames`, `phones`, `deposits`, `sellPrices`, `sellPriceMin/Max`, `commissions`, `commissionMin/Max`, `staffId`, `staffIds`, `smsStatus`, `messageStates`).
- **Thẻ "Đã cọc xvip"** ở đầu trang Báo cáo: bật/tắt `depositOnly`, dùng chung trạng thái và đồng bộ hoàn hảo với bảng đơn bên dưới.
- **Dọn dẹp tự động khi đổi khoảng ngày**:
  - Khi thay đổi `range` hoặc `basis`: `useEffect` tự động reset các mức checklist `deposits`, `sellPrices`, `commissions` về `undefined` để tránh bị khóa theo các giá trị tiền của khoảng ngày cũ.
  - Khi `filterOptions` / `staffOptions` cập nhật sau khi đổi ngày hoặc nhân viên: `useEffect` tự động lọc giữ lại chỉ những `staffIds`, `partners`, `routeIds` thực sự còn đơn trong khoảng thời gian mới.

### 3. Kết quả chạy kiểm tra mã nguồn (tsc, eslint, vitest)

- **Frontend TypeScript (`npx tsc --noEmit`)**:
  - Không có bất kỳ lỗi nào (`exit code 0`).
- **Frontend ESLint (`npx eslint ...`)**:
  - Đã chạy kiểm tra toàn bộ các file sửa đổi (`types.ts`, `api.ts`, `hooks.ts`, `OrderColumnFilters.tsx`, `quan-ly-ve/page.tsx`, `bao-cao/page.tsx`, `OptionFilterInput.tsx`). Kết quả: 0 error, 0 warning.
- **Backend TypeScript (`npx tsc --noEmit`)**:
  - 1 lỗi cũ duy nhất tại `test/app.e2e-spec.ts` (`Cannot find module 'supertest/types'`), ngoài ra toàn bộ mã nguồn backend không có lỗi nào khác.
- **Backend Vitest (`npx vitest run`)**:
  - 11/11 test files passed.
  - 66/66 unit tests passed (trong đó có 18 unit tests bao quát toàn bộ logic lọc cột deposits, sellPrices, commissions, partners XVIP, staffIds, messageStates, columnValues).
