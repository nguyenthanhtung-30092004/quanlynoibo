# TÀI LIỆU ÔN PHỎNG VẤN: Hệ thống Quản Lý Nội Bộ XVIP

> Viết cho người **hiểu hệ thống hoạt động ra sao nhưng chưa tự viết code**.
> Nguồn: source code hiện tại + toàn bộ lịch sử chat Claude của bạn (trích riêng các câu bạn đã yêu cầu).
> Đọc theo thứ tự. Phần 1 và phần 11 quan trọng nhất.

---

## 0. Đọc trước: một lời khuyên thẳng thắn

Bạn nói "chưa từng ghi một dòng code nào, chỉ hiểu hệ thống hoạt động thế nào". Vậy **sức mạnh thật của bạn** là:

- Bạn là người **ra yêu cầu nghiệp vụ**. Lịch sử chat cho thấy gần như mọi quy tắc của hệ thống đều xuất phát từ bạn: khóa giờ nhân viên, tách "đơn" và "vé", hoa hồng theo ghế, chấm công 8 tiếng, nhân viên chỉ sửa trong ngày…
- Bạn **vận hành và triển khai**: lên server AWS, Docker, nginx, CI/CD, đăng ký brandname SMS với VMG, cấu hình Zalo OA.
- Bạn **kiểm thử và phát hiện lỗi** rất sát (báo cáo lệch số, đối tác lạ "Cửa Ông 1", Excel thiếu vé hủy…).
- Bạn **điều phối AI** (Claude Code + Antigravity), viết task, review.

**Đừng nói** "em tự code toàn bộ backend NestJS". Người phỏng vấn chỉ cần hỏi 2-3 câu sâu là lộ ngay, và mất điểm trung thực nhiều hơn mất điểm kỹ năng. **Hãy nói đúng vai trò thật** (xem mục 1) rồi chứng minh bằng việc bạn *giải thích được hệ thống* ở mức tài liệu này.

Nếu công việc ứng tuyển là lập trình viên, hãy nói thẳng bạn đang ở giai đoạn học code và dùng AI để tăng tốc, đồng thời cho thấy bạn đang học (ví dụ đã hỏi AI giảng bài C++ cấu trúc dữ liệu, tự code một phần module warehouse rồi nhờ review, theo lịch sử chat). Vị trí phù hợp hơn: BA/QA/Product/Fresher có nền tảng, hoặc "AI-assisted developer".

---

## 1. Cách tự giới thiệu (mẫu, trung thực)

**Bản 30 giây:**
> "Em đã xây dựng và đưa vào vận hành một hệ thống quản lý nội bộ cho công ty vận tải/đặt vé xe XVIP: nhân viên lên đơn vé, admin xem báo cáo, công nợ đối tác, chấm công, bảng lương, tự gửi SMS/Zalo xác nhận cho khách. Em chịu trách nhiệm phân tích nghiệp vụ, thiết kế luồng và quy tắc, triển khai lên server AWS bằng Docker + nginx + CI/CD, và vận hành thực tế. Phần viết code em làm việc cùng công cụ AI (Claude Code, Antigravity), em viết yêu cầu, review và kiểm thử kết quả."

**Bản 2 phút (thêm):**
> "Hệ thống có frontend Next.js, backend NestJS, cơ sở dữ liệu PostgreSQL. Có phân quyền Admin và Nhân viên. Em xử lý các bài toán thực tế như: khóa tạo đơn ngoài giờ làm việc, nhân viên chỉ được sửa dữ liệu mình tạo trong ngày, báo cáo phân biệt 'đơn' và 'vé', tính công theo thời gian online, và cập nhật realtime cho nhiều người dùng cùng lúc. Gần đây em đang làm đợt tối ưu hiệu năng để chịu được nhiều người dùng đồng thời: thêm index, cache, tách service."

**Câu chốt khi bị hỏi "bạn code phần nào?":**
> "Em không tự gõ phần lớn code. Em định nghĩa yêu cầu, quy tắc nghiệp vụ, kiểm thử và triển khai; code do AI sinh theo yêu cầu của em. Em hiểu cách hệ thống chạy từ đầu đến cuối và có thể giải thích từng luồng, bây giờ em đang học để tự viết được nhiều hơn."

---

## 2. Hệ thống làm gì? (bức tranh lớn)

**Một câu:** phần mềm để nhân viên bán vé nhập "nhật ký vé" (mỗi dòng là một đơn đặt chỗ), và chủ/admin theo dõi doanh số, hoa hồng, công nợ với từng nhà xe đối tác, chấm công, tính lương.

**Ví dụ đời thường:** Khách gọi điện "Hà Nội đi Hạ Long 14h ngày 11/10, 2 ghế". Nhân viên mở web, nhập (hoặc dán nguyên đoạn tin nhắn, hệ thống tự điền), bấm lưu. Hệ thống:
1. Lưu đơn, tự gắn ngày vào sổ + tên nhân viên.
2. Tự tính hoa hồng nếu đối tác có cài "hoa hồng/ghế".
3. Tự gửi SMS hoặc Zalo xác nhận cho khách (nếu nhân viên tích chọn).
4. Admin thấy ngay doanh số, hoa hồng, số vé trên màn hình tổng quan (cập nhật trực tiếp, không cần F5).

### Các màn hình (menu `/xvip`)
| Trang | Dùng để |
|---|---|
| Tổng quan | Biểu đồ doanh số theo đối tác, tỷ lệ vé theo tuyến, xếp hạng nhân viên (Admin) |
| Quản lý vé | Tạo/sửa/hủy vé, bộ lọc kiểu Excel từng cột, xuất/nhập Excel, xem chi tiết, lịch sử sửa |
| Báo cáo | Thống kê theo ngày/nhân viên/tuyến/đối tác; bảng danh sách đơn đầy đủ trường |
| Công nợ | Mỗi đối tác: số đơn, số vé, tiền thu hộ, hoa hồng giữ lại, giá nhập phải trả |
| Đối tác, Tuyến đường | Danh mục (nhân viên được thêm/sửa trong ngày, Admin sửa tự do) |
| Nhân viên | Admin tạo tài khoản, đặt lại mật khẩu, khóa tài khoản |
| Chấm công | Ai online bao lâu, ngày công |
| Bảng lương | Công thức lương + số công tự điền |
| Cài đặt | Cấu hình hệ thống |

### Hai vai trò (rất hay bị hỏi)
| | ADMIN | STAFF (nhân viên) |
|---|---|---|
| Tạo đơn | Mọi lúc | Chỉ **04:30 – 22:30** giờ VN |
| Xem đơn | Tất cả | Chỉ của mình (nhưng **tìm kiếm** thì thấy vé phù hợp của cả người khác) |
| Sửa/xóa | Tự do | Chỉ bản ghi **do mình tạo, trong ngày hôm nay** |
| Doanh thu, giá nhập | Thấy | **Server không trả về** (không chỉ ẩn ở giao diện, vì gõ thẳng URL vẫn thấy) |
| Hoa hồng/ghế của đối tác | Thấy, chỉnh | Không thấy, không chỉnh |
| Lịch sử sửa do Admin | Thấy | Không thấy phần Admin sửa, vẫn thấy của nhân viên khác |
| Tổng quan | Có | Không vào được; xem báo cáo có **bảng xếp hạng số đơn/vé** của mọi người |

---

## 3. Thuật ngữ nghiệp vụ (nắm chắc để không nhầm)

- **Đơn** = một dòng nhật ký (một lần khách đặt). **Vé** = số ghế trong đơn đó. Đơn 3 ghế = 1 đơn, 3 vé.
  *Quy tắc tính vé (`ticketsOf`)*: nếu có "Số ghế" > 0 thì lấy số đó; nếu không thì cộng ghế **đầu + giữa + cuối**. Hai cách nhập độc lập vì mỗi nhà xe ghi khác nhau.
- **Ngày vào sổ** (entryDate): ngày tạo đơn, tự động. **Ngày khởi hành**: ngày xe chạy. Hai ngày khác nhau; báo cáo lọc được theo cả hai.
- **Giá nhập** (trả nhà xe) / **Giá bán** (thu của khách) / **Đã cọc** / **Nhờ thu** (thu hộ lúc khách lên xe) / **Hoa hồng** (hiển thị là "Doanh số" ở báo cáo).
- **Đối tác** = nhà xe/khách sạn mà công ty bán hộ (ví dụ Hải Phòng Travel, Interbus…). Đơn không có đối tác được coi là của **XVIP**.
- **Loại hình**: Xe Limousine, Xe Riêng, Cabin Đơn, Cabin Đôi, Giường Nằm, Gửi Hàng, Khách Sạn, Vé Fan.
- **Mã đơn**: hiển thị `XV` + id (ví dụ XV116).
- **Hủy vé**: không xóa, ghi `cancelledAt` + lý do; vé hủy **không tính** doanh thu/công nợ; xuất Excel thì dòng hủy tô đỏ.
- **Đặt lại vé**: tạo lại như một đơn mới (nên có tăng doanh thu).

---

## 4. Kiến trúc kỹ thuật

```
 Trình duyệt (nhân viên/admin)
        │  HTTPS
        ▼
     nginx  ── giới hạn tốc độ, SSL (Let's Encrypt), chặn /docs
        │
        ▼
   Next.js 14 (frontend, cổng 3000)
    ├─ giao diện React (App Router) + TanStack Query
    ├─ /api/auth/login|logout: tự set cookie phiên
    └─ /api/[...path]: "proxy" chuyển tiếp sang backend, tự gắn token
        │
        ▼
   NestJS (backend, cổng 3009)  ── REST API + SSE realtime
        │
        ├──► PostgreSQL 16 (dữ liệu)
        ├──► VMG BrandSMS  (gửi SMS thương hiệu)
        └──► Zalo ZNS      (gửi tin Zalo)
```

**Triển khai:** `docker-compose` gồm 4 container (postgres, backend, frontend, nginx) trên 1 máy chủ AWS EC2 (Ubuntu). Có script sao lưu DB (`backup-db.sh`, chạy bằng cron).

**CI/CD (GitHub Actions, file `.github/workflows/deploy.yml`):**
1. Push lên nhánh `main`.
2. Chạy test cho backend và frontend (song song).
3. Build ảnh Docker, đẩy lên GHCR (GitHub Container Registry).
4. Server **tự kéo bản mới mỗi phút** bằng `scripts/deploy-pull.sh` (không cần GitHub SSH vào server, an toàn hơn).

**Vì sao chọn vậy (lý do trả lời được):**
- **Next.js + NestJS (cùng TypeScript):** một ngôn ngữ cho cả hai phía, dễ chia sẻ kiểu dữ liệu, cộng đồng lớn.
- **PostgreSQL:** quan hệ chặt (đơn – tuyến – nhân viên), có `GROUP BY/SUM`, JSON, index mạnh.
- **Proxy qua Next:** token nằm trong cookie `httpOnly` (JavaScript trên trình duyệt không đọc được → giảm nguy cơ bị đánh cắp token do XSS).
- **SSE thay vì WebSocket:** chỉ cần server đẩy tin xuống (có đơn mới, đối tác đổi), SSE đơn giản hơn, tự nối lại.
- **Docker:** môi trường giống nhau giữa máy dev và server, triển khai lặp lại được.

---

## 5. Cơ sở dữ liệu (các bảng chính)

| Bảng | Nội dung |
|---|---|
| `users` | tài khoản, vai trò ADMIN/STAFF, `isActive`, `deletedAt` (xóa mềm), hash mật khẩu, hash refresh token |
| `orders` | từng đơn: ngày vào sổ, nhân viên (`createdById`), khách, SĐT, tuyến (`routeId`), giờ/ngày đi, loại hình, ghế đầu/giữa/cuối/số ghế, giá nhập, giá bán, cọc, nhờ thu, hoa hồng, đối tác, điểm đón/trả, ghi chú, trạng thái tin nhắn, `cancelledAt`, lý do hủy |
| `order_history` | lịch sử sửa đơn: ai, lúc nào, đổi gì (`changes` dạng JSON) |
| `routes` | tuyến đường (ví dụ "Hà Nội - Hạ Long") |
| `partners` | đối tác, kèm `commissionPerSeat` (hoa hồng/ghế, chỉ Admin thấy) |
| `carriers` | nhà xe (module cũ) |
| `app_settings` | cấu hình dạng key-value (cấu hình chấm công, công thức lương…) |
| `attendance_days` | mỗi người mỗi ngày: chuỗi **1440 ký tự '0'/'1'** (mỗi ký tự = 1 phút trong ngày) |
| `attendance_logins` | nhật ký đăng nhập/đăng xuất |

**Điểm hay để kể:** chấm công lưu bằng *bitmap 1440 phút* trong 1 dòng/ngày/người. Ghi 1 phút = đổi 1 ký tự (`overlay(...)`), đếm phút online = đếm số ký tự '1'. Rất gọn, không phải lưu hàng nghìn dòng.

---

## 6. Các luồng quan trọng (giải thích từng bước)

### 6.1 Đăng nhập & phiên (JWT)
1. Nhân viên nhập tài khoản (số điện thoại) + mật khẩu → Next gọi backend `/auth/login`.
2. Backend tìm user, so mật khẩu bằng **bcrypt** (hash một chiều, không giải ngược được).
3. Cấp **2 token**: *Access token* (ngắn hạn, mặc định 1 giờ) và *Refresh token* (dài hạn, 7 ngày).
4. Backend lưu **hash SHA-256 của refresh token** (không lưu token thật). Mỗi lần làm mới thì **xoay vòng** (token cũ vô hiệu). So sánh bằng `timingSafeEqual` để tránh dò theo thời gian.
5. Next đặt 2 token vào cookie `httpOnly` (`qlnb_at`, `qlnb_rt`). Trình duyệt không đọc được.
6. Mỗi request tới backend, `AuthGuard` kiểm tra chữ ký token **và hỏi lại DB**: tài khoản còn tồn tại, còn hoạt động, vai trò hiện tại là gì → đổi quyền/khóa tài khoản có hiệu lực **ngay**, không chờ token hết hạn.
7. Middleware của Next: chưa có phiên → đẩy về `/login`.
8. Đăng xuất / đổi mật khẩu: xóa hash refresh token → các thiết bị khác bị đăng xuất.

*Tại sao 2 token?* Access ngắn hạn nên lộ cũng ít hại; refresh dài hạn giúp người dùng không phải đăng nhập lại liên tục, và có thể **thu hồi** từ server.

### 6.2 Tạo đơn
1. Nhân viên mở popup "Thêm vé". Bắt buộc: SĐT, giờ đi, ngày khởi hành, tuyến, đối tác, loại hình, và **hoặc** số ghế **hoặc** ghế đầu/giữa/cuối. Thiếu thì hiện chữ đỏ dưới ô.
2. Có thể **dán đoạn tin nhắn** (giờ – tên – SĐT – đón – trả – số ghế), hệ thống tự phân tích (`parse-order-text.ts`) và điền vào form, nhân viên chỉnh lại.
3. Gửi lên `POST /orders`. Backend:
   - Nhân viên mà ngoài 04:30–22:30 → từ chối (Admin không bị khóa).
   - Kiểm tra tuyến còn hoạt động, đối tác phải **có trong bảng đối tác** (khớp không phân biệt hoa/thường, trả về tên chuẩn).
   - Chuẩn hóa tên khách **Viết Hoa Chữ Cái Đầu**.
   - Gắn `createdById` theo người đăng nhập (không tin client gửi lên), `entryDate` theo giờ VN.
   - Hoa hồng: nhập tay, hoặc gợi ý = `hoa hồng/ghế của đối tác × số ghế` (giao diện tự nhảy khi chọn đối tác + ghế).
   - Lưu đơn, ghi `order_history`, xóa cache báo cáo, phát sự kiện realtime.
4. Nếu nhân viên tích "gửi SMS/Zalo" → gọi luồng nhắn tin (6.5).

### 6.3 Phân quyền dữ liệu (đáng nhớ)
Quy tắc nằm **ở server**, ví dụ `canModifyOwnToday()`: Admin sửa tự do; nhân viên chỉ sửa bản ghi mình tạo **và** trong cùng ngày VN. Dữ liệu nhạy cảm (doanh thu, giá nhập) bị **xóa khỏi kết quả trả về** đối với nhân viên. Ý nghĩa: ẩn trên giao diện chưa đủ, vì người dùng gõ thẳng URL API vẫn xem được.

### 6.4 Bộ lọc kiểu Excel + danh sách vé
- Mỗi cột có hộp lọc: hiện **mọi giá trị đang có kèm số vé**, tích nhiều ô rồi Áp dụng.
- Quy ước: tích nhiều giá trị trong **một cột = HOẶC**; nhiều cột cùng lọc = **VÀ**.
- Danh sách các giá trị trong hộp lọc phản ánh bộ lọc của **các cột khác** (chọn nhân viên A thì chỉ hiện tuyến/đối tác của A).
- Phân trang ở **server** (lọc phải ở server vì không có toàn bộ dữ liệu ở trình duyệt). Xuất Excel dùng chung bộ lọc.

### 6.5 Gửi SMS / Zalo
- Có lớp trừu tượng `MessageProvider`: mỗi nhà cung cấp (eSMS, SpeedSMS, **VMG**, Zalo ZNS) là một lớp cùng giao diện; `MessagingService` chọn nhà cung cấp theo biến môi trường `SMS_PROVIDER`.
- Hiện dùng **VMG BrandSMS** cho SMS và **Zalo ZNS** cho Zalo (lịch sử chat: "bỏ qua esms, bỏ luôn vmg tôi làm việc với zalo", sau đó lại quay về VMG; cần xác nhận cấu hình đang chạy trong `.env` trên server).
- Nội dung tin **phải khớp mẫu đã đăng ký** với nhà mạng (mẫu "Quý Khách Đặt Thành Công Chuyến Xe …") nếu lệch chữ hoa/dấu câu sẽ bị từ chối (mã lỗi 011).
- **IP máy chủ phải được khai báo** với VMG (whitelist), vì vậy bạn từng phải tìm IP của server AWS.
- Chế độ thử `MESSAGING_DRY_RUN`: chỉ ghi log, không gửi, không đánh dấu "đã gửi".
- VMG báo kết quả **bất đồng bộ** qua **callback** (`/orders/vmg-callback?secret=…`): khi nhà mạng báo thành công/thất bại thì hệ thống cập nhật `messageStatus` theo `messageRefId`.
- Lỗi từng gặp: 304 = tin trùng lặp trong 5 phút; 904 = brandname không hợp lệ (phải viết hoa toàn bộ, đúng tên đăng ký).
- Trạng thái trên đơn: Chưa gửi / Đã gửi SMS / Đã gửi Zalo.

### 6.6 KPI, báo cáo, công nợ
- Báo cáo lọc theo ngày vào sổ hoặc ngày khởi hành, nhân viên, tuyến, đối tác. **Vé hủy không tính.**
- *Đơn* vs *vé* tách rõ (số đơn = số dòng; vé = số ghế).
- **Công nợ theo đối tác**: số đơn, số vé, thu hộ, hoa hồng giữ, tiền phải trả = giá nhập (nếu chưa có giá nhập thì lấy giá bán trừ hoa hồng). Đối tác **không có trong danh sách** bị loại và hiện ghi chú "Có N đơn thuộc đối tác không có trong danh sách…" (không loại âm thầm). Lý do: từng có dữ liệu cũ mang tên lạ như "Cửa Ông 1", "Sao Việt 1".
- Có **cache 3 giây + gộp truy vấn trùng (single-flight)** cho KPI: nhiều người cùng xem chỉ chạy một truy vấn.

### 6.7 Realtime (SSE)
- Mỗi trình duyệt mở 1 kết nối `EventSource` tới `/api/realtime/stream`.
- Mọi thao tác ghi thành công (POST/PATCH/PUT/DELETE) trên `orders/partners/routes/carriers/users` → server phát sự kiện "nhóm X đã đổi".
- Client nhận → tải lại các query liên quan (gộp trong 300 ms để nhiều sự kiện chỉ tải một lần). Có `ping` mỗi 25 giây để nginx không cắt kết nối.
- Cũng dùng để biết **ai đang online** (presence) và cho chuông thông báo.
- Hạn chế: bộ nhớ trong 1 tiến trình; nếu chạy nhiều bản backend phải chuyển sang Redis pub/sub.

### 6.8 Chấm công
- Nguyên tắc cuối cùng bạn chốt: **lần đăng nhập đầu tiên trong ngày** là mốc bắt đầu tính; trình duyệt gửi "heartbeat" mỗi **60 giây**; không bắt định vị, dùng điện thoại cũng được.
- Ghi vào bitmap 1440 phút (xem mục 5). **≥ 8 tiếng = 1 công, ≥ 4 tiếng = 0,5 công** (cấu hình được ở `app_settings`).
- Admin có thể ghi đè số công; có nhật ký đăng nhập/đăng xuất của từng người trong ngày.
- Thời gian luôn do **server** tính (giờ VN), không tin giờ máy khách (chống gian lận).
- Số công tự điền vào **Bảng lương**; công thức lương Admin sửa được, phép tính chạy ở giao diện để sửa công thức là thấy kết quả ngay.

### 6.9 Nhập / xuất Excel
- Xuất: ExcelJS, có viền toàn bộ, ngày dạng dd/mm/yyyy, dòng vé hủy tô đỏ, dòng TỔNG ngay dưới đơn cuối; loại các đơn đối tác ngoài danh sách và ghi chú số đơn bị loại. Có hàm `neutralizeFormula` để ô nội dung bắt đầu bằng `=`/`+`… không bị Excel hiểu là công thức (chống "Excel injection").
- Nhập: đọc file theo đúng cột, kiểm tra từng dòng như tạo đơn, tự viết hoa theo chuẩn hệ thống, báo lỗi theo dòng.

---

## 7. Bảo mật: đã làm gì, còn yếu gì (cần nói thật)

**Đã làm tốt**
- Mật khẩu hash bằng bcrypt; refresh token chỉ lưu hash; xoay vòng; `timingSafeEqual`.
- Token trong cookie `httpOnly`; mỗi request kiểm tra lại trạng thái tài khoản trong DB.
- `ValidationPipe` với `whitelist` + `forbidNonWhitelisted` (từ chối trường lạ), DTO kiểm tra kiểu.
- Phân quyền ở server (`AuthGuard` + `RolesGuard` + kiểm tra chủ sở hữu); dữ liệu nhạy cảm không trả về cho nhân viên.
- nginx: giới hạn `5 lần/phút/IP` cho đăng nhập, `30 request/giây/IP` chung, HSTS, X-Frame-Options, chặn `/docs` (Swagger tắt ở production).
- Truy vấn dùng tham số (không ghép chuỗi) → hạn chế SQL injection; LIKE có hàm escape.
- Sao lưu DB định kỳ; không commit `.env`.

**Điểm yếu / câu hỏi khó có thể gặp (nên biết trước)**
1. **Admin xem được mật khẩu nhân viên** (`password-vault.ts`, mã hóa AES-256-GCM hai chiều) — đây là **tính năng bạn yêu cầu** để tiện đặt lại, nhưng trái với thực hành chuẩn (mật khẩu chỉ nên hash một chiều, đặt lại bằng mật khẩu tạm). Nếu bị hỏi, hãy thừa nhận: *"Đây là yêu cầu nghiệp vụ của chủ, em hiểu rủi ro và sẽ đề xuất đổi sang luồng đặt lại mật khẩu."*
2. **Mật khẩu mặc định "123456"** khi tạo tài khoản và bỏ quy tắc 8 ký tự → yếu.
3. Khóa mã hóa mật khẩu suy ra từ `JWT_SECRET` nếu chưa đặt `PASSWORD_VIEW_KEY`.
4. **Bí mật từng bị dán vào chat** (token GitHub, khóa SSH, API key nhà cung cấp SMS, mã Zalo). Bạn nói đã xóa/đổi một số cái; **hãy chắc chắn đã đổi hết** (GitHub PAT, khóa SSH deploy, token VMG, token Zalo, API key Gemini) và không bao giờ dán lại vào chat.
5. Giới hạn nginx theo IP: nhiều nhân viên chung IP văn phòng có thể bị 429 oan.
6. Một tiến trình backend, chưa có giám sát/cảnh báo.

---

## 8. Hiệu năng & tối ưu (đợt đang làm)

**Vấn đề thực tế bạn từng gặp:** "vào danh sách vé mất 4-5 giây" (chat 9/10), "compile rất lâu", "build trên server lâu".

**Đã (hoặc đang) làm — hiện có trong thư mục dự án, chưa commit:**
- Tách file khổng lồ `orders.service.ts` (1855 dòng → còn ~220 dòng) thành các service: `command` (ghi), `query` (đọc), `report` (KPI/công nợ), `export`, `import`, `messaging`, `column-values`, cộng `OrderFilterBuilder` dùng chung một nơi dựng điều kiện lọc.
- **Migration thật** (TypeORM) thay cho việc chạy `ALTER TABLE` mỗi lần khởi động.
- **Index mới** (kép, một phần "chỉ đơn chưa hủy"), `pg_trgm` + GIN cho tìm kiếm, cột sinh sẵn (`partnerKey`, `customerKey`, `search_text`) để lọc không bị bọc hàm.
- Cấu hình **pool DB** (tối đa 25 kết nối), `statement_timeout` 10 giây.
- **Cache** bảng nhỏ (đối tác, tuyến) 30 giây; cache KPI 3 giây + single-flight.
- Interceptor ghi log **request chậm**; `enableShutdownHooks`.

**Còn lại (xem file `KE-HOACH-REFACTOR.md`):** KPI vẫn tải đơn lên Node rồi cộng (nên chuyển `GROUP BY` ở SQL), cache trạng thái tài khoản cho `AuthGuard`, giảm "bão tải lại" realtime (1 thao tác làm cả nghìn máy tải lại), bỏ chặng proxy Next cho API/SSE, tách trang `quan-ly-ve` 2199 dòng, Next `standalone`, load test.

**Cách nói khi phỏng vấn (an toàn, đúng):**
> "Em xác định điểm nghẽn bằng cách quan sát: danh sách chậm do lọc bọc hàm, không có index phù hợp và báo cáo tính cộng trong Node. Hướng xử lý: thêm index/cột chuẩn hóa, cache ngắn có gộp truy vấn trùng, đẩy tính toán xuống SQL, giảm số lần tải lại do realtime. Em đo bằng log request chậm và `EXPLAIN` trước và sau."
(Chỉ nói "em đã đo" nếu bạn thật sự chạy; nếu chưa thì nói "kế hoạch của em là đo bằng…".)

---

## 9. Cách làm việc với AI (câu hỏi rất hay gặp hiện nay)

- Công cụ: **Claude Code** (đọc code, sửa, chạy lệnh, push), **Antigravity** (AI khác để làm các task bạn giao).
- Quy trình bạn thật sự dùng (có trong chat): bạn mô tả yêu cầu → Claude làm/hoặc **viết file TASKS** (`TASKS*.md` trong thư mục dự án) để Antigravity làm → bạn bảo Claude **review** logic → push → CI/CD tự triển khai.
- Bạn rút ra bài học: Antigravity chạy chậm vì dùng WSL trên ổ `/mnt/c`, chạy test/tsc quá nhiều → bạn yêu cầu viết task "ngắn, chạy kiểm tra đúng phạm vi", "không chạy toàn bộ test giữa các task". (Đây là câu chuyện tốt để kể về việc tối ưu cách giao việc cho AI.)
- Điểm cần nói: **AI sinh code nhanh nhưng người phải chịu trách nhiệm** → bạn kiểm tra bằng cách test thật trên giao diện, đối chiếu số liệu báo cáo, bắt các lỗi lệch (ví dụ "đơn vs vé", đối tác lạ), và yêu cầu "nối logic chứ đừng làm để trưng bày".

---

## 10. Các dự án khác trong máy bạn (theo lịch sử chat, tóm tắt để không bị hỏi bất ngờ)

| Thư mục | Là gì (theo chat) |
|---|---|
| `Desktop/Quan_Ly_Noi_Bo` | Dự án chính ở trên (XVIP) |
| `D:/mes_backend` | Backend MES nhà máy may (NestJS, module garment, migration TypeORM). Bạn nhờ AI đọc, mô tả luồng, sơ đồ hoạt động, ví dụ API cho Swagger; kiểm tra logic nghiệp vụ nhà máy |
| `D:/mes_landing` | Landing page/website bán thiết bị ngành may (clone bố cục một site mẫu, danh mục sản phẩm, router React, ngrok để chia sẻ) |
| `D:/DuAnPlatform` | Nền tảng học/ôn thi "Trivietes": thiết kế lại giao diện student/giảng viên/tư vấn viên, trang Home |
| `Desktop/QT/garment-platform` + `QT` | Nền tảng MES nhà máy may kiến trúc **microservice** (api-masterdata, BOM, tuyến công đoạn, kho, đơn sản xuất…); bạn tự dựng entity nền và nhờ AI review |
| `Desktop/aodaiproject` | Web áo dài (socket báo đơn sắp hết hạn cho admin) |
| `Desktop/DATN/DoAnTotNghiep` | Đồ án tốt nghiệp (file `64CNTT3-...DATN` trên Desktop) |
| `Desktop/middlebackend` | Bài tập NestJS nhỏ (DI, Notification service + test) |
| `Desktop/Code C` | Bài tập C/C++ cấu trúc dữ liệu: "Hệ thống quản lý và xử lý đơn hàng" |
| `Desktop/AI` | Thử backend NestJS + extension Chrome gọi Gemini (có fallback nhiều model) |
| `Desktop/nginx-dockerfile` | Thực hành Dockerfile/nginx; gộp kho dữ liệu |

> Mình chỉ đọc **các câu bạn hỏi**, chưa đọc source các dự án này. Đừng nhận mình "làm sâu" những dự án mình chưa nắm.

---

## 11. Bộ câu hỏi phỏng vấn & câu trả lời mẫu

### A. Giới thiệu & vai trò
**1. Hệ thống này làm gì?** → Xem mục 2 (bản 30 giây).
**2. Bạn làm phần nào?** → Phân tích nghiệp vụ, định nghĩa quy tắc, kiểm thử, triển khai, vận hành; code do AI sinh theo yêu cầu, bạn review. Thành thật.
**3. Điều khó nhất?** → Gợi ý thật: đồng bộ **số liệu báo cáo** (đơn vs vé, vé hủy, đối tác lạ) và **tích hợp SMS** (brandname, mẫu tin, whitelist IP, callback).
**4. Bạn tự hào nhất điều gì?** → Hệ thống chạy thật, có người dùng, có CI/CD; xử lý được các quy tắc nghiệp vụ thực tế.

### B. Kiến trúc
**5. Vẽ kiến trúc?** → Sơ đồ mục 4.
**6. Vì sao Next gọi API qua proxy thay vì gọi thẳng backend?** → Giữ token trong cookie httpOnly, không để JS trình duyệt chạm token; tự làm mới token khi hết hạn; tránh CORS. Nhược: thêm một chặng Node (đã ghi trong kế hoạch tối ưu).
**7. Realtime làm thế nào?** → SSE (mục 6.7).
**8. Vì sao SSE không phải WebSocket?** → Chỉ cần một chiều server→client; đơn giản, tự nối lại, qua HTTP/nginx dễ.
**9. Deploy ra sao?** → Docker compose + nginx + Let's Encrypt trên EC2; GitHub Actions build ảnh đẩy GHCR; server kéo bản mới mỗi phút.
**10. Sao lưu?** → Script `pg_dump` nén gz chạy cron; cần nói thêm: nên lưu bản sao ra ngoài máy chủ (S3) và thử khôi phục định kỳ.

### C. Backend & dữ liệu
**11. Phân biệt authentication và authorization?** → Xác thực = bạn là ai (đăng nhập/JWT); phân quyền = bạn được làm gì (Admin/Staff, chỉ sửa của mình trong ngày).
**12. JWT là gì, vì sao 2 token?** → Mục 6.1.
**13. Vì sao hash mật khẩu mà không mã hóa?** → Hash một chiều, lộ DB cũng không biết mật khẩu. (Rồi thừa nhận chỗ "Admin xem mật khẩu" là ngoại lệ do yêu cầu nghiệp vụ.)
**14. Index là gì? Bạn thêm index nào, vì sao?** → Như mục lục sách: tìm nhanh không phải lật hết. Ví dụ index `(createdAt DESC, id DESC)` cho danh sách mới nhất trước; index một phần `WHERE cancelledAt IS NULL` cho báo cáo chỉ tính vé còn hiệu lực.
**15. Vì sao lọc `LOWER(partner)` chậm?** → Bọc hàm quanh cột làm index thường không dùng được; giải pháp: cột sinh sẵn đã chuẩn hóa + index.
**16. Phân trang OFFSET có vấn đề gì?** → Trang càng sâu càng chậm vì DB phải bỏ qua N dòng; keyset pagination dùng "lấy sau mốc (createdAt, id)".
**17. Migration là gì?** → Chuỗi thay đổi cấu trúc DB có phiên bản, chạy theo thứ tự, có thể quay lui; tốt hơn tự `ALTER` khi khởi động hay bật `synchronize` trên production (có thể làm mất dữ liệu).
**18. Giao dịch (transaction) dùng khi nào?** → Khi nhiều thao tác phải cùng thành công hoặc cùng thất bại (ví dụ nhập Excel nhiều dòng).
**19. N+1 query là gì?** → Lấy danh sách rồi cứ mỗi dòng lại truy vấn thêm một lần; cách tránh: join hoặc lấy gộp bằng `IN`.
**20. Xóa mềm là gì?** → Đánh dấu `deletedAt` thay vì xóa dòng (giữ lịch sử, tránh lỗi khóa ngoại). Dùng cho `users`.
**21. Cache có rủi ro gì?** → Dữ liệu cũ. Giảm bằng TTL ngắn, xóa cache khi ghi, và sự kiện realtime.
**22. Múi giờ xử lý ra sao?** → Mọi "ngày" nghiệp vụ tính theo `Asia/Ho_Chi_Minh` ở server; không tin giờ máy khách (khóa giờ, chấm công, ngày vào sổ).

### D. Frontend
**23. Next.js khác React thường?** → Có routing theo thư mục, render phía server, API routes/middleware, tối ưu build.
**24. TanStack Query để làm gì?** → Quản lý dữ liệu từ server: cache, tải lại, trạng thái loading/lỗi. Khi realtime báo đổi thì "invalidate" để tải lại đúng phần.
**25. Vì sao trang quản lý vé chậm/compile lâu?** → Một file hơn 2000 dòng, một component quá lớn, nhiều state → render và biên dịch nặng; hướng xử lý: tách component, nạp modal khi cần, memo dòng bảng, debounce tìm kiếm.
**26. Làm sao responsive?** → Bảng cuộn ngang có thanh kéo trên đầu, cột STT/Thao tác ghim, thẻ (card) cho điện thoại, popup lọc.

### E. Bảo mật
**27. Các lỗ hổng web phổ biến bạn biết?** → SQL injection (dùng tham số hóa), XSS (cookie httpOnly, React tự escape), CSRF, brute force (rate limit), Excel injection (`neutralizeFormula`), lộ bí mật (`.env`).
**28. Chỗ nào chưa an toàn?** → Mục 7 (nói thật, kèm hướng sửa).

### F. Quy trình & chất lượng
**29. Có test không?** → Có vitest cho nhiều phần (khóa giờ, lọc theo đối tác, logic chấm công, bộ lọc cột, guard…); CI chạy test trước khi build. Nói đúng: phần lớn test do AI viết, bạn dùng test để bảo vệ hành vi khi refactor.
**30. Bạn kiểm thử thủ công thế nào?** → Tạo dữ liệu thực, đối chiếu số trên báo cáo với danh sách; thử bằng 2 vai trò; thử gõ URL trực tiếp để kiểm tra quyền.
**31. Gặp lỗi production bạn làm gì?** → Xem log container (`docker compose logs`), tái hiện, sửa, đẩy `main`, CI tự triển khai. Ví dụ thật: lỗi 502 khi gửi SMS → đọc thông báo VMG (mã 304/904) → sửa cấu hình.
**32. Nếu 1000 người dùng thì sao?** → Mục 8 + file kế hoạch: index, cache, SQL aggregate, giảm bão tải lại, nhiều tiến trình + Redis.

### G. Câu hỏi "bẫy" về kỹ năng
**33. "Hãy giải thích đoạn code này" (đưa một hàm).** → Đọc từ tên hàm, đầu vào, đầu ra, rồi từng nhánh `if`. Nếu không chắc, nói: "Em sẽ đọc lại và cho anh/chị biết ý hiểu của em…" Đừng đoán bừa.
**34. "Bạn viết thử hàm X ngay đây."** → Trung thực: "Em chưa quen viết tay, nhưng em có thể mô tả thuật toán/luồng ra sao." Rồi mô tả bằng lời.
**35. "Vì sao chọn NestJS?"** → Cấu trúc module/DI rõ ràng, phù hợp dự án nhiều nghiệp vụ; (và nói thật nếu đó là gợi ý từ nền tảng/AI).

---

## 12. Nên và không nên

**Nên:**
- Dẫn dắt bằng *bài toán nghiệp vụ*, rồi mới nói kỹ thuật.
- Mang số liệu thật: số đơn/ngày, số nhân viên, số đối tác (hãy tự điền con số thật của công ty bạn).
- Chuẩn bị 2 câu chuyện kể (STAR): (1) báo cáo lệch số → tìm nguyên nhân → thống nhất "đơn/vé" → kiểm tra lại; (2) SMS không gửi được → brandname, mẫu tin, whitelist IP → chạy được.
- Thừa nhận giới hạn và nói bạn đang học gì tiếp (SQL, TypeScript, Docker).

**Không nên:**
- Nhận mình tự code backend/frontend.
- Bịa con số hiệu năng ("nhanh gấp 10 lần") khi chưa đo.
- Nói hệ thống "chịu 1000 người" khi chưa load test.
- Che giấu việc dùng AI; hiện nay nhiều nơi coi đó là kỹ năng nếu bạn kiểm soát được chất lượng.

---

## 13. Kế hoạch ôn 3 ngày

**Ngày 1:** đọc mục 2-6; tự vẽ lại sơ đồ kiến trúc và luồng đăng nhập/tạo đơn trên giấy, không nhìn tài liệu.
**Ngày 2:** mở chạy hệ thống local, tạo đơn, hủy, xuất Excel, xem lịch sử, đổi quyền Admin/Staff; mở `docker compose logs`; đọc mục 7-8. Thử tự giải thích từng bước bằng lời (ghi âm rồi nghe lại).
**Ngày 3:** luyện 35 câu ở mục 11 thành tiếng; luyện 2 câu chuyện STAR; chuẩn bị 3 câu hỏi để hỏi lại nhà tuyển dụng (quy trình review, mô hình làm việc với AI, lộ trình học).

**Bài tập nhỏ tự kiểm tra:**
1. Một đơn có `seatCount=0, đầu=2, giữa=1, cuối=0` thì mấy vé? *(3)*
2. Nhân viên A tạo đơn lúc 23:00, kết quả? *(bị khóa; Admin thì được)*
3. Nhân viên có sửa được đơn do mình tạo hôm qua không? *(không, chỉ trong ngày)*
4. Online 5 tiếng được mấy công? *(0,5)*
5. Vì sao gõ thẳng URL API doanh thu vẫn không thấy được với nhân viên? *(server không trả về trường đó)*

---

## 14. Từ điển nhanh

- **API**: cổng để chương trình này gọi chương trình kia (ví dụ giao diện gọi backend).
- **REST**: kiểu API dùng GET/POST/PATCH/DELETE theo tài nguyên.
- **DTO**: khuôn dữ liệu vào/ra và quy tắc kiểm tra.
- **Entity**: lớp đại diện một bảng DB.
- **ORM (TypeORM)**: viết thao tác DB bằng code thay vì SQL thuần.
- **Guard**: "bảo vệ cổng" kiểm tra quyền trước khi vào hàm xử lý.
- **Interceptor**: đoạn xử lý bọc quanh request (ví dụ ghi log chậm, phát sự kiện realtime).
- **JWT**: chuỗi đã ký chứa thông tin người dùng, server kiểm tra chữ ký để tin.
- **SSE**: server đẩy sự kiện xuống trình duyệt qua một kết nối HTTP mở lâu.
- **CI/CD**: tự động test, build và triển khai khi push code.
- **Docker / docker-compose**: đóng gói ứng dụng thành container và chạy nhiều container cùng lúc.
- **Reverse proxy (nginx)**: cổng trước, nhận request từ internet rồi chuyển vào các dịch vụ bên trong.
- **Index**: cấu trúc giúp DB tìm nhanh.
- **Migration**: thay đổi cấu trúc DB có phiên bản.
- **Cache**: lưu tạm kết quả để lần sau trả nhanh.
- **Brandname SMS**: tin nhắn hiện tên thương hiệu thay vì số lạ, phải đăng ký mẫu tin với nhà mạng.
- **Callback / webhook**: nhà cung cấp gọi ngược về hệ thống mình khi có kết quả.
- **Whitelist IP**: chỉ IP được khai báo mới được gọi API của nhà cung cấp.
