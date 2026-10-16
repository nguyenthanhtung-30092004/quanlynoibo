# KẾ HOẠCH REFACTOR & TỐI ƯU: Quản Lý Nội Bộ (XVIP)

Mục tiêu: 1000 người dùng đồng thời vẫn nhanh, backend truy vấn cực nhanh, frontend chia component chuẩn, build/compile nhanh, không lag.
m,

> Lưu ý trung thực: dự án có ~26.700 dòng TS/TSX. Mình đã đọc kỹ các điểm nóng (orders.service, entity, guard, realtime, attendance, proxy, providers, hooks, nginx, Docker) chứ chưa đọc từng dòng của mọi file. Các con số "mục tiêu" bên dưới là mục tiêu cần đo lại, chưa phải kết quả đo.

---

## 1. Hiện trạng: những điểm nghẽn tìm thấy

### Backend

| #   | Vấn đề                                                                                                                            | Vị trí                                                         | Vì sao chậm khi 1000 user                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `AuthGuard` truy vấn DB **ở mọi request** (`findAuthState`)                                                                       | `auth.guard.ts:55`                                             | 1000 user × nhiều request/phút → hàng nghìn query nhỏ chỉ để biết "user còn hoạt động không"                                                                                 |
| B2  | KPI, công nợ, xuất Excel **tải TOÀN BỘ đơn lên Node rồi cộng bằng vòng lặp JS** (`getMany` rồi `reduce`/`Map`)                    | `kpiOrders`, `kpi`, `debts`, `kpiFilterOptions`, `exportExcel` | Đơn nhiều lên thì RAM + CPU Node tăng tuyến tính; DB đã có SUM/GROUP BY nhanh gấp trăm lần. `kpiFilterOptions` còn tải toàn bộ đơn chỉ để lấy danh sách id                   |
| B3  | Tìm kiếm `ILIKE '%từ%'` trên 8 cột nối bằng OR                                                                                    | `buildListQuery` ~dòng 1720                                    | `%...%` không dùng được B-tree index → quét toàn bảng mỗi lần gõ tìm                                                                                                         |
| B4  | Lọc cột dùng hàm: `LOWER(partner)`, `LOWER(customerName)`, `TRIM(...)`, `CAST(... AS text) LIKE`, `TO_CHAR(...) LIKE`             | `buildListQuery`, `columnValues`                               | Bọc hàm quanh cột thì index thường bị bỏ qua                                                                                                                                 |
| B5  | `columnValues`: mỗi lần mở một hộp lọc cột là một `GROUP BY` quét lại bảng, có 12+ nhánh                                          | dòng 1175-1460                                                 | Mở hộp lọc ở nhiều tab/nhiều người → tải DB lớn, mà dữ liệu thay đổi chậm                                                                                                    |
| B6  | Thiếu index cho các truy vấn thật sự dùng                                                                                         | `order.entity.ts`                                              | Chỉ có index đơn lẻ; thiếu index kép cho sắp xếp `createdAt DESC, id DESC`, cho KPI `(entryDate, createdById)`, cho đơn chưa hủy, cho `messageRefId` (callback VMG), `phone` |
| B7  | `findAll` đếm `getCount()` mỗi lần đổi trang + phân trang OFFSET                                                                  | `findAll`                                                      | OFFSET sâu thì chậm dần; COUNT trên bảng lớn tốn kém                                                                                                                         |
| B8  | **Không có migration**; `OrdersSchemaGuard` chạy `ALTER TABLE ... IF NOT EXISTS` mỗi lần khởi động (cả `attendance-schema.guard`) | `orders-schema.guard.ts`                                       | Tạo bảng/cột bằng DDL lúc chạy: khó kiểm soát, khó rollback, khởi động chậm, không an toàn khi chạy nhiều bản backend                                                        |
| B9  | Cấu hình pool DB mặc định (10 kết nối), không `statement_timeout`                                                                 | `app.module.ts`                                                | 1000 user dễ cạn pool, request xếp hàng chờ                                                                                                                                  |
| B10 | Bảng nhỏ (đối tác, tuyến, cấu hình chấm công) được đọc lại từ DB ở mỗi lần tạo/sửa đơn, mỗi heartbeat                             | `create`, `update`, `heartbeat -> loadConfig`                  | Dữ liệu gần như không đổi mà đọc hàng nghìn lần                                                                                                                              |
| B11 | `importExcel` lưu **từng dòng một**                                                                                               | `importExcel`                                                  | Nhập 500 dòng = 500+ lần round-trip DB                                                                                                                                       |
| B12 | `orders.service.ts` **1855 dòng**, `query-orders.dto.ts` 522 dòng; `kpiOrders` và `buildListQuery` lặp lại cùng logic lọc         |                                                                | Khó sửa, khó test, dễ lệch logic giữa các màn                                                                                                                                |
| B13 | Một tiến trình Node, presence trong bộ nhớ; không nén, không cache header, không health check                                     | `realtime.service.ts`, `main.ts`                               | Không scale ngang được, một lỗi là sập hết                                                                                                                                   |

### Realtime / hạ tầng

| #   | Vấn đề                                                                                                                                                            | Hệ quả                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **"Bão tải lại" (thundering herd)**: mỗi lần có 1 thao tác ghi, server phát sự kiện cho **tất cả** tab, client nào cũng `invalidate` `orders` + `kpi` rồi tải lại | 1 người sửa 1 vé → 1000 máy cùng gọi lại danh sách + KPI = hơn 2000 request cùng lúc. **Đây là nguyên nhân dễ gây lag nhất khi đông người**                 |
| R2  | Mỗi lần ai đó mở/đóng tab, server phát sự kiện `presence` cho tất cả                                                                                              | Thêm 1 đợt tải lại `online-users` mỗi lần có người vào/ra                                                                                                   |
| R3  | Mỗi request đi **2 chặng Node**: trình duyệt → nginx → Next.js (route proxy `/api/[...path]`) → Nest                                                              | Gấp đôi độ trễ, gấp đôi RAM, Next phải buffer body (`arrayBuffer`)                                                                                          |
| R4  | **SSE đi qua Next.js** (`/api/realtime/stream`): 1000 kết nối dài đều giữ trong tiến trình Next                                                                   | Tốn RAM Next, dễ nghẽn event loop của server render trang                                                                                                   |
| R5  | nginx: `limit_conn perip 40` + `limit_req 30r/s` **theo IP**                                                                                                      | Văn phòng dùng chung 1 IP công cộng (NAT) cho nhiều nhân viên: mỗi tab giữ 1 kết nối SSE nên chạm trần 40 kết nối/IP; bị 429 oan. Cũng chưa bật gzip/brotli |
| R6  | Heartbeat chấm công 60s/lần/user, mỗi lần đọc cấu hình từ DB + 1 upsert                                                                                           | ~17 request/giây ở 1000 user, vẫn ổn nếu bỏ phần đọc cấu hình                                                                                               |

### Frontend

| #   | Vấn đề                                                                                                                                                                                                                       | Vị trí                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **`quan-ly-ve/page.tsx` 2191 dòng**, riêng component `TicketManagementPage` dài ~1870 dòng; bên trong còn khai báo `NumInput`, `MoneyInput`, `Field`, `Section`                                                              | Mọi state trong 1 component → mỗi lần gõ phím là render lại cả trang; compile chậm vì một file khổng lồ                                                 |
| F2  | `bao-cao/page.tsx` 1117 dòng, `OrderColumnFilters.tsx` 982 dòng, `nhan-vien` 644, `tuyen-duong` 633, `bang-luong` 580                                                                                                        | Cùng bệnh                                                                                                                                               |
| F3  | `MoneyInput` có 2 bản (inline trong page và `features/payroll/MoneyInput.tsx`); nhiều component chọn/lọc chồng chéo: `PickerInput`, `SuggestInput`, `RouteCombobox`, `OptionFilterInput`, `MultiCheckSelect`, `ColumnFilter` | Lặp code, UI thiếu đồng nhất                                                                                                                            |
| F4  | Hầu hết trang là `'use client'` (51 file có hooks/state)                                                                                                                                                                     | Không tận dụng Server Components, gửi nhiều JS cho trình duyệt                                                                                          |
| F5  | React Query: `refetchOnWindowFocus: true`, `staleTime` 15 giây cho mọi thứ                                                                                                                                                   | Mỗi lần người dùng quay lại tab, hàng loạt query tải lại, trong khi đã có SSE rồi. Danh mục (tuyến, đối tác, nhà xe) ít đổi mà vẫn tải lại thường xuyên |
| F6  | `invalidateQueries({ queryKey: ['orders'] })` quá rộng (cả hộp lọc, lịch sử, chi tiết cùng bị làm mới)                                                                                                                       | Tải lại thừa                                                                                                                                            |
| F7  | antd 5 + Tailwind + Phosphor + dayjs cùng lúc; Next 14; Docker chạy `npm start` và cài lại `node_modules` ở image cuối                                                                                                       | Bundle lớn, build chậm, image nặng. Cần đo bằng bundle analyzer trước khi kết luận antd chiếm bao nhiêu                                                 |
| F8  | Modal (Create/Edit/Detail/History/Sms) và các thư viện nặng nạp ngay từ đầu                                                                                                                                                  | Nên nạp khi mở                                                                                                                                          |

---

## 2. Nguyên tắc & mục tiêu

- **Đo trước, sửa sau**: không tối ưu theo cảm tính. Mỗi bước có số đo trước/sau.
- **Giữ nguyên hành vi nghiệp vụ**: viết test "chụp lại" kết quả của KPI, công nợ, lọc cột TRƯỚC khi viết lại bằng SQL, rồi so sánh kết quả cũ/mới.
- **Mục tiêu hiệu năng (cần xác nhận bằng load test)**:
  - Danh sách vé (có lọc, phân trang): p95 < 150 ms ở 1000 người dùng ảo.
  - KPI / Báo cáo / Công nợ: p95 < 200 ms.
  - Mở hộp lọc cột: p95 < 100 ms (có cache).
  - Một thao tác ghi không làm tăng đột biến quá ~10% request/giây.
  - JS tải lần đầu của trang Quản lý vé giảm ít nhất 40% so với hiện tại (đo bằng bundle analyzer).
  - `next dev` đổi 1 file: biên dịch lại < 1-2 giây; `next build` giảm rõ rệt.

---

## 3. Lộ trình theo giai đoạn

### Giai đoạn 0: Đo đạc nền (1-2 ngày)

1. Bật `pg_stat_statements` trên Postgres; ghi lại top 20 query chậm/nhiều nhất.
2. `EXPLAIN (ANALYZE, BUFFERS)` cho: danh sách vé, KPI, công nợ, `columnValues`, tìm kiếm.
3. Viết kịch bản **k6** (hoặc autocannon): đăng nhập, mở danh sách, đổi trang, lọc, KPI, SSE, heartbeat với 100 → 500 → 1000 người dùng ảo. Lưu kết quả làm mốc.
4. `@next/bundle-analyzer` + đo thời gian `next build`, `next dev` (thời gian biên dịch từng trang).
5. Chụp "golden output" (JSON kết quả) của `kpi`, `debts`, `kpiFilterOptions`, `columnValues`, `exportExcel` trên một bộ dữ liệu mẫu để so sánh sau này.

### Giai đoạn 1: Thắng nhanh, rủi ro thấp (2-3 ngày)

- **B1** Cache trạng thái tài khoản trong bộ nhớ (LRU, TTL ~30s), xóa cache ngay khi khóa/đổi quyền/xóa user → không còn 1 query/request.
- **B9** Cấu hình pool (`extra.max` 20-30, `idleTimeoutMillis`, `statement_timeout` ~10s, `application_name`).
- **B10** Cache bộ nhớ có TTL + xóa khi ghi cho: đối tác, tuyến, nhà xe, cấu hình chấm công, cài đặt.
- **R5** nginx: bật gzip/brotli; tách giới hạn: SSE không tính vào `limit_conn` 40; tăng ngưỡng/ giới hạn theo user (token) thay vì chỉ theo IP; giữ giới hạn chặt riêng cho `/login`.
- **F5** React Query: tắt `refetchOnWindowFocus` (đã có SSE), `staleTime` 5 phút + `gcTime` dài cho danh mục.
- **F8** Nạp modal bằng `next/dynamic`; thêm `antd` vào `optimizePackageImports`.
- **R2** Bỏ phát `presence` cho mọi người: chỉ gửi cho Admin (người cần xem online), gộp/giãn 2-5 giây.

### Giai đoạn 2: Cơ sở dữ liệu (3-5 ngày)

1. **Chuyển sang migration thật** (TypeORM migrations): đưa toàn bộ DDL trong `orders-schema.guard.ts`, `attendance-schema.guard.ts` thành migration đánh số; xóa DDL lúc chạy; thêm bước `migration:run` vào quy trình deploy (script, hoặc container chạy trước).
2. **Index mới** (tạo bằng `CREATE INDEX CONCURRENTLY` để không khóa bảng):
   - `orders (createdAt DESC, id DESC)` cho danh sách Admin.
   - `orders (createdById, createdAt DESC, id DESC)` cho danh sách nhân viên.
   - `orders (entryDate, createdById) WHERE "cancelledAt" IS NULL` (partial) cho KPI/công nợ.
   - `orders (departureDate) WHERE "cancelledAt" IS NULL`, `orders (routeId, entryDate)`.
   - `orders (messageRefId) WHERE "messageRefId" IS NOT NULL` cho callback VMG.
   - `orders (phone)` (và `text_pattern_ops` nếu tìm theo tiền tố).
   - `order_history (orderId, createdAt DESC)` và `(createdAt DESC)` cho "hoạt động gần đây".
3. **Tìm kiếm nhanh (B3)**: bật `pg_trgm` + GIN index `gin_trgm_ops` trên `customerName`, `phone`, `note`, `pickupPoint`, `dropoffPoint`... hoặc gom một cột `search_text` (generated) rồi đánh 1 index GIN. `ILIKE '%x%'` khi đó dùng được index.
4. **Chuẩn hóa để bỏ hàm quanh cột (B4)**: thêm cột sinh sẵn `partnerKey = lower(trim(coalesce(partner,'XVIP')))`, `customerKey = lower(trim(coalesce(customerName,'khách lẻ')))` (STORED generated) + index. Lọc `IN (...)` trực tiếp trên cột này.
5. **Phân trang (B7)**: danh sách dùng **keyset pagination** (`WHERE (createdAt,id) < (:c,:i)`) cho cuộn/đổi trang tuần tự; giữ OFFSET cho nhảy trang nhưng giới hạn tối đa; `total` đếm chính xác chỉ khi cần, hoặc chặn ở "10.000+" cho bộ lọc rộng; có thể cache tổng 5-10 giây.
6. Với dữ liệu lớn dài hạn: cân nhắc **partition bảng `orders` theo tháng** (`entryDate`) và bảng tổng hợp ngày `orders_daily_stats` (xem 3.3).
7. Tinh chỉnh Postgres (`shared_buffers`, `work_mem`, `effective_cache_size`, autovacuum cho bảng `orders`/`order_history`).

### Giai đoạn 3: Refactor backend (5-8 ngày)

**3.1 Tách `orders.service.ts` (1855 dòng) thành các lớp có trách nhiệm rõ:**

```
modules/orders/
  orders.module.ts
  controllers/        orders.controller.ts, orders-reports.controller.ts, vmg-callback.controller.ts
  services/
    orders-command.service.ts     // create, update, cancel, remove, import (ghi)
    orders-query.service.ts       // findAll, findOne, history, activity (đọc)
    orders-report.service.ts      // kpi, debts, kpiFilterOptions
    orders-export.service.ts      // xuất Excel (streaming)
    orders-column-values.service.ts
    orders-messaging.service.ts   // gửi SMS/Zalo, trạng thái, callback
  filters/
    order-filter.builder.ts       // MỘT nơi duy nhất dựng WHERE, dùng cho list/kpi/export/columnValues
    order-filter.dto.ts           // chia nhỏ DTO 522 dòng thành nhóm (ngày, tiền, văn bản, trạng thái tin)
  mappers/order.mapper.ts         // toView
  repositories/order.repository.ts
```

**3.2 Một bộ dựng bộ lọc duy nhất (B12)**: `OrderFilterBuilder` nhận DTO và trả điều kiện; `buildListQuery`, `kpiOrders`, `exportExcel`, `columnValues` cùng dùng. Hết tình trạng lọc lệch nhau giữa các màn.

**3.3 Đẩy tính toán xuống SQL (B2)**:

- `kpi`: một truy vấn `GROUP BY` (dùng `GROUPING SETS (staff, route, partner, ())`) thay vì tải toàn bộ đơn rồi tính trong JS. Tổng ghế = `SUM(seatFront + seatMiddle + seatBack)` hoặc cột `tickets` có sẵn.
- `debts`: `GROUP BY partnerKey` rồi ghép với bảng đối tác ở SQL (`LEFT JOIN`), cột `excluded` tính bằng một truy vấn phụ.
- `kpiFilterOptions`: `SELECT DISTINCT` / `array_agg(DISTINCT ...)`, không tải đơn.
- Tùy chọn: bảng tổng hợp `orders_daily_stats (entryDate, staffId, routeId, partnerKey, orders, seats, sell, cost, deposit, commission)` cập nhật bằng trigger hoặc job; KPI "hôm nay" đọc nhanh, KPI khoảng dài cộng từ bảng này.
- **Cache KPI** theo (bộ lọc, quyền) 3-5 giây với **single-flight** (nhiều người cùng hỏi chỉ chạy 1 query).

**3.4 Xuất Excel (B2)**: dùng `ExcelJS` chế độ **streaming writer** + đọc DB bằng cursor/`stream()`, không nạp cả bảng vào RAM; giới hạn đồng thời (hàng đợi) để 1 người xuất file lớn không làm nghẽn người khác.

**3.5 `importExcel` (B11)**: kiểm tra hợp lệ cả file trước, rồi chèn **theo lô** (`INSERT ... VALUES` nhiều dòng, 200-500 dòng/lô) trong **một transaction**; ghi lịch sử theo lô.

**3.6 `columnValues` (B5)**: tách mỗi cột thành một "strategy" nhỏ; dùng cột chuẩn hóa + index; cache 10-30 giây theo (cột, bộ lọc khác, từ khóa); giới hạn số giá trị trả về (ví dụ 200) + tìm kiếm phía server.

**3.7 Chống N+1 & chọn đúng cột**: `select` chỉ các cột cần cho danh sách (bỏ `note`, `cancelReason`... nếu bảng không hiện); join chỉ lấy `id, fullName`/`id, name`.

**3.8 Nền tảng chung**:

- Chuyển sang **Fastify adapter** (nhanh hơn Express đáng kể) hoặc ít nhất bật `compression`; thêm `helmet`, `ETag`/`304` cho các GET danh mục.
- Endpoint `/health` (DB ping) và graceful shutdown.
- Interceptor ghi thời gian request chậm (> 300 ms) vào log.
- Rate limit theo **user** (`@nestjs/throttler`), không chỉ theo IP.
- Chạy **nhiều tiến trình** (PM2 cluster hoặc `deploy: replicas` trong compose) + chuyển presence/pub-sub sang **Redis** (B13).

### Giai đoạn 4: Realtime thông minh (2-3 ngày) — giải quyết R1, R2, R4

- Sự kiện mang theo **thông tin cụ thể** (`orders: {action:'update', ids:[12]}`) thay vì chỉ "orders đã đổi".
- Client chỉ `invalidate` **query đang hiển thị** (`refetchType: 'active'`), và nếu sự kiện chỉ liên quan 1 vé thì **cập nhật trực tiếp vào cache** (`setQueryData`) thay vì tải lại cả danh sách.
- Thêm **jitter ngẫu nhiên 0.3-2 giây** trước khi tải lại để 1000 máy không bắn cùng lúc; gộp (debounce) phía server 200-500 ms.
- Server cache + single-flight cho danh sách/KPI (3.3) nên dù nhiều máy hỏi cũng chỉ chạm DB vài lần.
- Một kết nối SSE cho nhiều tab của cùng trình duyệt (`BroadcastChannel`/SharedWorker).
- SSE **không đi qua Next.js**: nginx trỏ `/api/realtime/stream` thẳng vào Nest (xem phần 5).
- Presence chỉ phát cho Admin, dồn mỗi 3-5 giây.

### Giai đoạn 5: Refactor frontend (8-12 ngày)

**5.1 Cấu trúc thư mục theo tính năng:**

```
src/
  app/                      // chỉ route + layout, mỗi page mỏng (< 100 dòng)
  features/
    orders/
      components/           // OrdersTable, OrderRow(memo), OrderFiltersBar, OrderToolbar, OrderPagination
      modals/               // CreateOrderModal, EditOrderModal, OrderDetailModal, OrderHistoryModal, SmsModal (nạp động)
      filters/              // từng bộ lọc cột nhỏ: RouteFilter, PartnerFilter, StaffFilter, PriceFilter...
      hooks/                // useOrdersQuery, useOrderFilters (đồng bộ URL), useOrderSelection
      lib/                  // parse-order-text, format, build-preview
    reports/ debts/ payroll/ attendance/ users/ partners/ routes/ carriers/
  components/
    ui/                     // Button, Modal, Table, Pagination, Badge, EmptyState, Skeleton
    form/                   // Field, Section, NumberInput, MoneyInput (MỘT bản duy nhất), DateRange
    filter/                 // ColumnFilterPopover, CheckListFilter, NumberRangeFilter (dùng chung mọi bảng)
    pickers/                // Picker/Combobox/MultiSelect gộp từ PickerInput, SuggestInput, RouteCombobox, OptionFilterInput, MultiCheckSelect
  lib/                      // api-client, format, time, query-keys
```

**5.2 Tách `quan-ly-ve/page.tsx` (2191 dòng):**

- Page chỉ ghép: `<OrdersToolbar/> <OrderFiltersBar/> <OrdersTable/> <OrdersPagination/>` + modal nạp động.
- Trạng thái bộ lọc gom vào một hook `useOrderFilters` (lưu trên URL để F5/chia sẻ link vẫn giữ lọc), không rải 30 `useState`.
- Dòng bảng là `React.memo` + `key` ổn định; handler dùng `useCallback`; tính toán nặng dùng `useMemo`. Gõ phím ở ô tìm kiếm có debounce 300 ms, không render lại cả bảng.
- Form tạo/sửa vé dùng chung một `OrderForm` (hiện Create và Edit lặp phần lớn).
- `bao-cao`, `nhan-vien`, `tuyen-duong`, `bang-luong`, `cong-no`, `cham-cong` tách theo cùng khuôn.

**5.3 Dùng chung & đồng nhất (F3):**

- Chỉ một `MoneyInput`, một `Field/Section`, một bộ lọc cột dựa trên `ColumnFilterPopover` + `CheckListFilter` (hiện `OrderColumnFilters.tsx` 982 dòng lặp cấu trúc: chia nhỏ mỗi cột một file ~40-80 dòng, dùng factory cho các cột cùng kiểu: danh sách tick, khoảng số, khoảng ngày).
- Hợp nhất các picker/combobox thành 2-3 component cơ sở.

**5.4 Dữ liệu & cache (F5, F6):**

- Tập trung **query key factory** (`queryKeys.orders.list(filters)`, `.detail(id)`, `.columnValues(col, filters)`) và invalidate chính xác.
- Danh mục (tuyến, đối tác, nhà xe, nhân viên): `staleTime` dài, tải một lần dùng chung toàn app.
- `columnValues` chỉ gọi khi hộp lọc **đang mở** (`enabled: open`), có debounce khi gõ tìm.
- Cân nhắc sinh client từ OpenAPI (Swagger đã có) để dùng chung kiểu dữ liệu FE/BE, hết lệch kiểu.

**5.5 Server Components & bundle (F4, F7):**

- Layout/shell và phần tĩnh của trang là Server Component; chỉ phần tương tác mới `'use client'`.
- Kiểm tra bundle: nếu antd chiếm nhiều mà chỉ dùng vài component (Modal/Table/DatePicker...), thay bằng component nhẹ tự viết hoặc giữ antd nhưng import theo từng component và bỏ `AntdRegistry` nếu không cần SSR style.
- Nâng **Next 14 → 15** và bật **Turbopack** cho `next dev` (biên dịch nhanh hơn rõ); dùng `output: 'standalone'` (xem 6).
- Tránh import "barrel" (`index.ts` gom nhiều file) trong các thư mục lớn; import trực tiếp.
- Bảng dài (nếu cho xem > 100 dòng/trang): ảo hóa bằng `@tanstack/react-virtual`.

### Giai đoạn 6: Hạ tầng & build nhanh (2-3 ngày)

- **Bỏ proxy Next cho API (R3, R4)**: nginx trỏ `/api/*` thẳng vào Nest, chỉ giữ `/api/auth/login|logout|refresh` ở Next (hoặc chuyển luôn sang Nest set cookie httpOnly; Nest đọc token từ cookie). Mỗi request giảm một chặng Node.
- Dockerfile frontend: `output: 'standalone'` (copy `.next/standalone`), không `npm ci` lại ở image cuối, chạy `node server.js`. Image nhẹ, khởi động nhanh, ít RAM.
- Dockerfile backend: BuildKit cache mount cho `npm ci`; giữ build nhiều tầng.
- CI (GitHub Actions): cache `node_modules`, cache `.next/cache`, chạy `tsc`, `vitest`, `oxlint` song song; build ảnh Docker có `cache-from/cache-to`.
- Docker compose: giới hạn RAM/CPU từng dịch vụ; `healthcheck` cho backend; thêm Redis khi chạy nhiều bản backend; (tùy) PgBouncer trước Postgres.
- Giám sát: Prometheus/Grafana hoặc ít nhất log thời gian request + `pg_stat_statements`.

### Giai đoạn 7: Load test & tinh chỉnh cuối (2-3 ngày)

- Chạy lại k6 như giai đoạn 0; so sánh p50/p95/p99, số lỗi, CPU/RAM Node & Postgres.
- Thử kịch bản "bão": 1000 người dùng cùng online, 20 người cùng sửa vé liên tục, 5 người cùng xuất Excel.
- Sửa các điểm nghẽn còn lại theo số đo.

---

## 4. Thứ tự ưu tiên (tác động / công sức)

| Ưu tiên | Việc                                                                                      | Tác động khi đông người                                 |
| ------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1       | R1 giảm bão tải lại (sự kiện chi tiết, `setQueryData`, jitter, chỉ refetch query đang mở) | Rất lớn                                                 |
| 2       | B1 cache trạng thái tài khoản                                                             | Lớn                                                     |
| 3       | B2 đẩy KPI/công nợ/xuất Excel xuống SQL + cache                                           | Rất lớn                                                 |
| 4       | B6/B3/B4 index kép, trigram, cột chuẩn hóa                                                | Rất lớn                                                 |
| 5       | R3/R4 bỏ chặng Next cho API và SSE                                                        | Lớn                                                     |
| 6       | R5 sửa giới hạn nginx theo IP/kết nối                                                     | Tránh chặn oan (quan trọng nếu dùng chung IP văn phòng) |
| 7       | F1-F3 tách trang khổng lồ + dùng chung component                                          | Lớn cho trải nghiệm & tốc độ dev/compile                |
| 8       | B8 migration thay cho DDL lúc chạy                                                        | An toàn khi triển khai                                  |
| 9       | Nhiều tiến trình backend + Redis                                                          | Cần khi vượt giới hạn 1 tiến trình                      |

---

## 5. Rủi ro & cách phòng

- **Sai lệch số liệu khi viết lại KPI/công nợ bằng SQL**: so sánh kết quả cũ/mới bằng golden test trên dữ liệu thật (bản sao).
- **Cache cũ gây hiển thị sai**: TTL ngắn (3-30 giây), xóa cache khi ghi, và sự kiện SSE làm mới tức thì.
- **Tạo index trên bảng đang chạy**: dùng `CONCURRENTLY`, làm ngoài giờ cao điểm, có sao lưu trước.
- **Đổi luồng xác thực (bỏ proxy Next)**: làm ở nhánh riêng, thử kỹ cookie/refresh token/CORS; có phương án quay lại.
- **Refactor FE lớn**: làm từng trang, giữ giao diện y nguyên, thêm test (vitest đã có) cho hook và hàm lọc; phát hành từng phần.
- Mỗi giai đoạn là một nhánh/PR riêng, không gộp một cục.

---

## 6. Ước lượng thời gian

| Giai đoạn     | Thời gian ước tính                                           |
| ------------- | ------------------------------------------------------------ |
| 0 Đo nền      | 1-2 ngày                                                     |
| 1 Thắng nhanh | 2-3 ngày                                                     |
| 2 CSDL        | 3-5 ngày                                                     |
| 3 Backend     | 5-8 ngày                                                     |
| 4 Realtime    | 2-3 ngày                                                     |
| 5 Frontend    | 8-12 ngày                                                    |
| 6 Hạ tầng     | 2-3 ngày                                                     |
| 7 Load test   | 2-3 ngày                                                     |
| **Tổng**      | **~25-39 ngày làm việc** (một người; có thể song song BE/FE) |

---

## 7. Bước tiếp theo đề xuất

1. Chốt thứ tự: bắt đầu **Giai đoạn 0 + 1** (nhanh, ít rủi ro, thấy hiệu quả ngay).
2. Cho mình quyền chạy đo đạc (EXPLAIN, k6, bundle analyzer) trên bản sao dữ liệu, không chạm production.
3. Mình bắt tay làm từng giai đoạn, mỗi giai đoạn báo cáo số đo trước/sau.
