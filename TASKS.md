# TASKS cho Antigravity

Làm lần lượt từng task. Xong task nào thì đổi `[ ]` thành `[x]` và ghi 1-2 dòng đã sửa gì. Không commit, không push, không chạy server.

**Cách chạy lệnh:** dùng **PowerShell trên Windows**, không dùng WSL (dự án nằm ở ổ C, WSL rất chậm và thiếu binding). Kiểm tra kiểu bằng `npx tsc --noEmit` trong `frontend` và `backend` (backend có sẵn 1 lỗi cũ ở `test/app.e2e-spec.ts` về `supertest/types`, bỏ qua). Test backend: `npx vitest run <tên file>` trong `backend`.

## Bối cảnh

Form vé và API đã chặn đối tác ngoài danh sách (bảng đối tác). Nhưng dữ liệu cũ vẫn còn vé mang tên đối tác lạ (ví dụ "Cửa Ông 1", "Sao Việt 1"), và **xuất Excel vẫn cho xuất các đối tác không có trong danh sách**. Cần chặn ở các lần xuất Excel.

Tên đối tác "có trong danh sách" = khớp một dòng bảng đối tác, không phân biệt hoa thường, bỏ khoảng trắng đầu/cuối. Dùng lại hàm `matchCanonicalPartner` ở `backend/src/modules/orders/order-partner.util.ts`. Đơn **không có đối tác (rỗng)** vẫn hợp lệ, không bị loại.

## Task 1: Xuất Excel công nợ đối tác chỉ gồm đối tác trong danh sách

- [x] Đã sửa:
  - Backend (`orders.service.ts`): hàm `debts` và `exportDebts` khớp tên chuẩn qua `matchCanonicalPartner`, gom nhóm theo tên chuẩn, ghi nhận `excluded` ({ orders, partners }); file Excel thêm dòng ghi chú đỏ dưới dòng TỔNG khi có đơn bị loại.
  - Frontend: cập nhật kiểu `PartnerDebt` (`types.ts`), `api.ts`, trang Công nợ (`cong-no/page.tsx`) hiển thị khung ghi chú số đơn và tên đối tác bị loại.

**File:** `backend/src/modules/orders/orders.service.ts`, hàm `debts` (khoảng dòng 786) và `exportDebts` (khoảng dòng 809). Controller: `orders.controller.ts` (`GET debts`, `GET debts/export`).

**Yêu cầu**
1. Hàm `debts` chỉ trả các nhóm có tên đối tác khớp bảng đối tác. Tên lấy theo **tên chuẩn** trong bảng đối tác, và gộp các biến thể hoa/thường về một dòng.
2. Các đơn mang đối tác ngoài danh sách **không được biến mất âm thầm**. Trả thêm số đơn và số tên đối tác bị loại (ví dụ `excluded: { orders, partners: string[] }`), để bảng công nợ trên giao diện và file Excel hiện một dòng ghi chú: "Có N đơn thuộc đối tác không có trong danh sách (tên A, B) nên không được tính".
3. Cả bảng công nợ trên giao diện (`GET debts`) và file Excel (`GET debts/export`) dùng cùng hàm nên số liệu phải khớp nhau.
4. Cập nhật kiểu `PartnerDebt` ở frontend (`frontend/src/features/orders/types.ts`) và nơi hiển thị trang Công nợ (`frontend/src/app/xvip/cong-no/`) để hiện dòng ghi chú ở điểm 2.

**Tiêu chí hoàn thành:** file Excel công nợ không còn dòng đối tác ngoài danh sách; có dòng ghi chú số đơn bị loại; bảng giao diện và file Excel cùng số liệu; `tsc` hai bên không thêm lỗi mới.

## Task 2: Xuất Excel danh sách đơn không đưa đơn có đối tác ngoài danh sách

- [x] Đã sửa:
  - Tách hàm thuần `filterOrdersByPartner` trong `order-partner.util.ts` và viết test đơn vị đầy đủ trong `order-partner.util.spec.ts`.
  - Backend (`orders.service.ts`): hàm `exportExcel` lọc bỏ đơn có đối tác ngoài danh sách, thêm vào tiêu đề phụ `, M đơn bị loại vì đối tác không có trong danh sách` khi M > 0, các công thức SUM/COUNT chỉ tính trên đơn hợp lệ còn lại.

**File:** `backend/src/modules/orders/orders.service.ts`, hàm `exportExcel` (route `GET orders/export`).

**Yêu cầu**
1. Loại khỏi file Excel các đơn có đối tác khác rỗng nhưng **không** khớp bảng đối tác.
2. Không loại âm thầm: trong dòng tiêu đề phụ của file (chỗ đang ghi "Tổng N đơn: … hợp lệ, … đã hủy") thêm "M đơn bị loại vì đối tác không có trong danh sách". Nếu M bằng 0 thì không ghi.
3. Dòng TỔNG và công thức SUM trong file chỉ tính các đơn còn lại.
4. Đơn không có đối tác (rỗng) vẫn được xuất.
5. Viết test đơn vị cho hàm lọc nếu tách ra được thành hàm thuần (thêm vào `order-partner.util.spec.ts` hoặc file spec mới cùng thư mục).

**Tiêu chí hoàn thành:** xuất Excel không còn đơn đối tác lạ; tiêu đề phụ ghi số đơn bị loại; tổng khớp số dòng trong file; `tsc` backend không thêm lỗi mới; test mới qua.

## Task 3: Báo lại danh sách đối tác lạ cho Admin trên giao diện

- [x] Đã sửa:
  - Backend: thêm hàm `findUnlistedPartners` trong `order-partner.util.ts` (kèm test đơn vị), method `unlistedPartners` trong `orders.service.ts` và API `GET orders/unlisted-partners` bảo vệ bằng `@Roles(UserRole.ADMIN)` trong `orders.controller.ts`.
  - Frontend: thêm hook `useUnlistedPartners` và hiển thị khung cảnh báo màu vàng ở đầu trang Quản lý vé (`quan-ly-ve/page.tsx`) cho Admin (cho phép bấm vào từng đối tác lạ để tìm kiếm vé tương ứng và sửa lại).

**Mục đích:** Admin biết đang có đối tác lạ để sửa vé, không phải đoán vì sao số Excel ít hơn.

**Yêu cầu**
1. Thêm API `GET orders/unlisted-partners` (chỉ Admin) trả danh sách `{ partner: string, orders: number }` các tên đối tác trên đơn còn hiệu lực mà không khớp bảng đối tác (gom theo tên không phân biệt hoa thường, sắp theo số đơn giảm dần).
2. Ở trang Công nợ hoặc Quản lý vé (chọn chỗ hợp lý, Admin mới thấy) hiện một khung cảnh báo nhỏ: "Có N đối tác không có trong danh sách: A (x đơn), B (y đơn). Tìm theo tên ở ô tìm kiếm của Quản lý vé và sửa lại đối tác." Không có đối tác lạ thì không hiện khung.
3. Không tự động sửa dữ liệu.

**Tiêu chí hoàn thành:** Admin thấy đúng danh sách tên lạ và số đơn; nhân viên không gọi được API; `tsc` hai bên không thêm lỗi mới.

---

# Đợt 2: Giờ online, tự điền công, danh sách người đang online

## Bối cảnh

Dự án **đã có** module chấm công (`backend/src/modules/attendance/`): nhân viên gửi heartbeat mỗi phút, server đánh dấu phút đó vào cột `bits` (1440 ký tự) của bảng `attendance_days`, hiện chỉ tính khi **dùng máy tính + ở trong bán kính công ty (định vị)**. Số công tính bởi `congFromMinutes` trong `attendance.logic.ts`, mặc định 420 phút = 1 công, `halfMinutes` = 0 (tắt nửa công). Trang Bảng lương (`frontend/src/app/xvip/bang-luong/page.tsx`) có nút "Điền công từ chấm công" phải bấm tay (`fillFromAttendance`). Dự án cũng **đã có** kênh realtime một chiều bằng SSE (`backend/src/modules/realtime/`, frontend `features/realtime/RealtimeProvider.tsx`) đi qua proxy Next `frontend/src/app/api/[...path]/route.ts`.

Yêu cầu mới của chủ: tính công theo **thời gian nhân viên đăng nhập / online trong ngày**: online đủ **8 tiếng = 1 công**, đủ **4 tiếng = 0,5 công**; công này **tự điền** vào ô "Công thực tế" ở Bảng lương; và Admin xem được **ai đang online**.

Quy tắc chung: làm lần lượt, xong task nào đổi `[ ]` thành `[x]` kèm 1-2 dòng đã sửa gì. Không commit, không push, không chạy server. Dùng PowerShell. Viết test đơn vị cho mọi hàm logic mới.

### Cách làm nhanh (bắt buộc, chạy lệnh rất tốn thời gian)

1. **Đọc và sửa hết trước, kiểm tra một lần ở cuối.** Không chạy `tsc` hay test sau từng file. Chạy kiểm tra đúng **một lần sau khi xong cả 4 task**, rồi chỉ chạy lại khi có lỗi cần sửa.
2. **Test chỉ chạy đúng file spec liên quan**, không chạy toàn bộ: `npx vitest run src/modules/attendance src/modules/realtime` trong `backend`. Cấm chạy `npm test`, test e2e, `npm run build`, `next build`, `lint` toàn dự án.
3. **`tsc` chạy song song, không chờ lần lượt:** mở hai lệnh PowerShell cùng lúc, một cho `backend`, một cho `frontend`. Thêm `--incremental` nếu có tsbuildinfo. Chỉ đọc dòng lỗi thuộc file mình sửa, bỏ qua lỗi cũ (`test/app.e2e-spec.ts`).
4. **Không khởi động server, không mở trình duyệt, không gọi API thật.** Chủ tự kiểm tra bằng tay. Nếu cần kiểm tra logic thì dựa vào test đơn vị của hàm thuần.
5. **Không đọc lại file vừa sửa, không đọc file không liên quan.** Mọi đường dẫn cần thiết đã ghi trong từng task; dùng grep đúng tên hàm thay vì quét cả thư mục. Không đọc `package-lock.json`, `*.tsbuildinfo`, `node_modules`.
6. **Gom sửa:** một file cần nhiều chỗ thì sửa một lượt, không lặp "sửa nhỏ rồi chạy lại". Task 4, 5, 6 cùng đụng `attendance.logic.ts` và `cham-cong/page.tsx` nên làm liền nhau.
7. **Không cài thêm thư viện, không chạy `npm install`.**
8. Cuối cùng báo gọn: file đã sửa, kết quả `tsc` hai bên, kết quả test, và những gì chưa kiểm tra được.

## Task 4: Đổi quy tắc công sang 8 tiếng = 1 công, 4 tiếng = 0,5 công

- [x] Đã sửa:
  - Cập nhật `DEFAULT_ATTENDANCE_CONFIG` thành 480 phút (8 tiếng) = 1 công, 240 phút (4 tiếng) = 0,5 công; cập nhật test đơn vị `attendance.logic.spec.ts` kiểm tra đầy đủ các mốc 239, 240, 479, 480 phút.
  - Trang Chấm công (`cham-cong/page.tsx`) cho phép Admin chỉnh sửa hai ngưỡng và hiển thị chú thích trực quan quy đổi "Đủ N giờ = 1 công, Đủ M giờ = 0,5 công".

**File:** `backend/src/modules/attendance/attendance.logic.ts`, `attendance.logic.spec.ts`, và nơi hiển thị cấu hình ở `frontend/src/app/xvip/cham-cong/page.tsx`.

**Yêu cầu**
1. Đổi mặc định `DEFAULT_ATTENDANCE_CONFIG`: `fullMinutes: 480`, `halfMinutes: 240`.
2. DB có thể đang lưu cấu hình cũ (420 / 0) trong bảng `app_setting` khóa `attendance_config`. Không tự ghi đè dữ liệu đó; chỉ đảm bảo trang cấu hình ở Chấm công cho Admin sửa được hai ngưỡng này và hiển thị rõ "đủ N giờ = 1 công, đủ M giờ = 0,5 công" (đổi từ phút sang giờ cho dễ đọc). Ghi chú trong câu trả lời cuối là Admin cần vào đó chỉnh lại nếu cấu hình cũ còn 420/0.
3. Cập nhật test `attendance.logic.spec.ts`: 239 phút = 0 công, 240 = 0,5, 479 = 0,5, 480 = 1 (theo mặc định mới).

**Tiêu chí hoàn thành:** test mới qua; `tsc` hai bên không thêm lỗi mới.

## Task 5: Tính giờ theo thời gian đăng nhập (online), không bắt buộc định vị

- [x] Đã sửa:
  - Bỏ hoàn toàn định vị (`workplace`, `radiusM`, `maxAccuracyM`, `distanceMeters`, `lastDistanceM`) và bỏ chặn di động ở cả backend và frontend; `sanitizeAttendanceConfig` tương thích cấu hình cũ có trường vị trí.
  - `evaluateBeat` kiểm tra `role === 'STAFF'` và `active = true` (có thao tác chuột/phím/chạm trong 5 phút gần nhất). Chip `AttendanceChip.tsx` hiển thị tiến độ online và mốc công (ví dụ "5g20 / 8g · 0,5 công"), tự tạm dừng khi idle hoặc tab ẩn, mất mạng không báo lỗi lớn.

**Mục đích:** nhân viên mở hệ thống và đang làm việc thì cộng giờ, không phụ thuộc định vị công ty.

**Yêu cầu**
1. Định nghĩa "online một phút" ở một hàm thuần trong `attendance.logic.ts`: nhân viên (`STAFF`) có kết nối realtime đang mở **và** có thao tác thật (chuột / phím / chuyển tab) trong vòng **5 phút gần nhất** (tránh treo máy qua đêm vẫn được tính). Client gửi heartbeat mỗi phút như hiện tại, kèm cờ `active` (true nếu có thao tác trong 5 phút); server chỉ đánh dấu phút khi `active = true`.
2. **Bỏ hẳn định vị** (chủ đã quyết, không làm công tắc). Xóa khỏi `attendance.logic.ts`, `attendance.service.ts`, `dto/attendance.dto.ts`, frontend (`features/attendance/*`, `app/xvip/cham-cong/page.tsx`): `workplace`, `radiusM`, `maxAccuracyM`, `distanceMeters`, các lý do `not_configured` / `no_location` / `low_accuracy` / `out_of_range`, việc xin quyền vị trí trên trình duyệt, phần cài vị trí công ty ở trang Chấm công, và cột `lastDistanceM` khỏi câu lệnh ghi (không cần xóa cột DB, không viết migration). `evaluateBeat` chỉ còn kiểm tra: là nhân viên (`STAFF`) và `active = true`. Điện thoại vẫn được tính công (bỏ luôn `isMobileUserAgent` / lý do `mobile`). `sanitizeAttendanceConfig` vẫn đọc được cấu hình cũ có các trường thừa mà không lỗi, chỉ bỏ qua chúng. Dọn các test cũ liên quan định vị trong `attendance.logic.spec.ts`.
3. Vẫn dùng cột `bits` để đếm (mỗi phút 1 bit, tránh đếm trùng khi mở nhiều tab). Ngày tính theo giờ Việt Nam bằng `vietnamClock` như cũ; phút trước 0h và sau 0h tách sang hai ngày khác nhau.
4. Chip trạng thái ở đầu trang (`frontend/src/features/attendance/AttendanceChip.tsx`) hiện số giờ:phút online hôm nay, đồng hồ đếm, và mốc tới 4h / 8h (ví dụ "5g20 / 8g · 0,5 công").
5. Mất mạng / đóng tab: không cộng, không báo lỗi lớn cho người dùng.

**Tiêu chí hoàn thành:** test đơn vị cho `evaluateBeat` mới (active/idle, staff/admin; không còn nhánh định vị; cấu hình cũ có trường vị trí vẫn đọc được); chip hiển thị đúng; `tsc` hai bên không thêm lỗi mới.

## Task 6: Tự động điền công vào Bảng lương

- [x] Đã sửa:
  - Khi mở Bảng lương (`bang-luong/page.tsx`), tự động tải dữ liệu từ `attendanceApi.month` và điền công cho nhân viên chưa có công đã lưu (`workDays === null`). Giữ nguyên số công Admin đã nhập hoặc đã Lưu trước đó.
  - Ô được tự động điền hiển thị huy hiệu "từ chấm công" (tháng hiện tại thêm ghi chú "(đang tính đến hôm nay)"), khi nhập tay sẽ xóa huy hiệu; dữ liệu tự điền ở trạng thái nháp cho Admin bấm Lưu; lỗi lấy chấm công không chặn bảng lương.

**File:** `frontend/src/app/xvip/bang-luong/page.tsx` (hàm `fillFromAttendance`, khoảng dòng 136), có thể thêm endpoint trong `backend/src/modules/payroll/`.

**Yêu cầu**
1. Khi Admin mở Bảng lương của tháng nào, ô "Công thực tế" của từng nhân viên **tự điền** từ tổng công chấm công của tháng (`attendanceApi.month`, giá trị `totalCong`), không cần bấm nút. Nút "Điền công từ chấm công" giữ lại để điền lại thủ công.
2. Chỉ tự điền cho nhân viên **chưa có số công đã lưu** trong bảng lương tháng đó (`workDays === null`). Số Admin đã nhập tay hoặc đã Lưu thì **không ghi đè**.
3. Ô nào được điền tự động thì có chú thích nhỏ "từ chấm công" để Admin phân biệt với số nhập tay. Điền xong chỉ ở trạng thái nháp; Admin vẫn phải bấm Lưu bảng lương.
4. Tháng hiện tại: công đang dở (chưa đủ cả tháng), ghi chú "đang tính đến hôm nay".
5. Lỗi gọi chấm công không được chặn việc mở bảng lương: bỏ qua và hiện toast.

**Tiêu chí hoàn thành:** mở bảng lương tháng có dữ liệu thì công tự có; sửa tay rồi lưu thì lần mở sau giữ số đã lưu; `tsc` hai bên không thêm lỗi mới.

## Task 7: Admin xem danh sách tài khoản đang online (socket)

- [x] Đã sửa:
  - Backend: Quản lý presence trong `RealtimeService` theo kết nối stream SSE, phát sự kiện realtime topic `presence`, API `GET realtime/online` chỉ Admin gọi được (nhân viên bị 403) trả danh sách kèm `todayMinutes`.
  - Frontend: Thêm topic `presence` trong `RealtimeProvider`, thêm khối "Đang online (N)" ở trang Chấm công và huy hiệu trên header `XvipShell`; viết test `realtime.presence.spec.ts` kiểm thử mở 2 tab đóng 1 vẫn online và đóng hết thì offline.

**Quyết định kỹ thuật:** dự án đã có SSE (`GET realtime/stream`) chạy qua proxy Next. **Dùng lại kết nối SSE này làm kênh online**, không cài thêm `socket.io` vì WebSocket không đi qua được route proxy `app/api/[...path]/route.ts` của Next và phải sửa hạ tầng/nginx. Nếu chủ vẫn muốn socket.io thật, dừng lại và hỏi trước.

**Yêu cầu**
1. Backend, `realtime.service.ts`: thêm bộ theo dõi presence trong bộ nhớ, `Map<userId, số kết nối đang mở>`. Khi `RealtimeController.stream` có kết nối mới thì tăng, khi `Observable` bị hủy (finalize) thì giảm; về 0 thì coi là offline. Một người mở nhiều tab vẫn chỉ là một người. Lưu thêm `lastSeenAt`. Cần lấy `userId` từ request (`@CurrentUser` hoặc decorator có sẵn ở `auth/decorators`).
2. Phát sự kiện realtime khi presence đổi (ví dụ topic mới `presence`, thêm vào `REALTIME_TOPICS`) để màn Admin tự cập nhật, không phải F5.
3. API `GET realtime/online` **chỉ Admin** (`@Roles(UserRole.ADMIN)`), trả `[{ userId, fullName, role, connections, onlineSince, lastSeenAt, todayMinutes }]` (`todayMinutes` lấy từ chấm công của Task 5). Nhân viên gọi phải bị 403.
4. Frontend Admin: một khối "Đang online (N)" (đặt ở trang Chấm công hoặc đầu trang quản trị `XvipShell`, chọn chỗ hợp lý) liệt kê tên, vai trò, giờ online hôm nay, thời điểm vào. Cập nhật khi nhận sự kiện `presence`. Dùng `RealtimeProvider.tsx` hiện có, đừng mở thêm kết nối thứ hai.
5. Backend chỉ chạy một tiến trình nên Map trong bộ nhớ là đủ; thêm comment như `RealtimeService` đã ghi (nhiều bản cần Redis). Server khởi động lại thì danh sách rỗng rồi tự đầy lại khi client kết nối lại; kiểm tra client có tự reconnect.
6. Test đơn vị cho bộ presence: mở 2 kết nối cùng user rồi đóng 1 vẫn online, đóng nốt thì offline.

**Tiêu chí hoàn thành:** Admin thấy đúng ai đang online và tự cập nhật khi có người vào/ra; nhân viên không gọi được API; `tsc` hai bên không thêm lỗi mới; test presence qua.
