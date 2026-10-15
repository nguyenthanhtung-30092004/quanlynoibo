# TASKS: Nhập Excel chỉ lấy 13 cột, hỗ trợ tiêu đề hai tầng

Làm lần lượt, xong thì đổi `[ ]` thành `[x]` và ghi 1-2 dòng đã sửa gì. Không commit, không push, không chạy server. **Làm nhanh:** không chạy toàn bộ test giữa các task. Chỉ chạy kiểm tra đúng phía vừa sửa; chạy `tsc` và toàn bộ vitest **một lần duy nhất sau Task 3**. Dùng PowerShell, không dùng WSL.

## Bối cảnh

File Excel thật có tiêu đề **hai tầng**: dòng 1 có `NGÀY VÀO SỐ, NV, TÊN KHÁCH, SỐ ĐIỆN THOẠI, TUYẾN ĐI, GIỜ ĐI, NGÀY KHỞI HÀNH, LOẠI HÌNH, VỊ TRÍ (gộp ô), GIÁ NHẬP, GIÁ BÁN, THÀNH TIỀN xvip, ĐÃ CỌC, NHỜ THU, LÃI, ĐỐI TÁC`; dòng 2 có `ĐẦU, GIỮA, CUỐI, SỐ GHẾ` nằm dưới ô gộp "VỊ TRÍ". Chữ tiêu đề lẫn hoa/thường (ví dụ `GiỜ ĐI`).

Hiện parser chỉ tìm cột trong **một** dòng, nên ĐẦU/GIỮA/CUỐI/SỐ GHẾ không được nhận và mọi đơn báo "thiếu số ghế". Ngoài ra parser đang đọc cả cột tiền (giá nhập, giá bán, đã cọc, nhờ thu, lãi) và NV, ô rác ở các cột này làm cả dòng lỗi.

**File:** `backend/src/modules/orders/order-import.parser.ts` (hàm `parseOrderWorkbook`). Phần đối chiếu tuyến/đối tác/trùng lặp ở `services/orders-import.service.ts` giữ nguyên.

## Task 1: Đọc tiêu đề hai tầng

- [x] Đã hoàn thành: Quét gộp cột ở dòng r và r+1; tự động phát hiện ĐẦU/GIỮA/CUỐI/SỐ GHẾ ở dòng dưới để bắt đầu dữ liệu sau dòng đó, vẫn tương thích hoàn hảo tiêu đề 1 tầng.

**Yêu cầu**
1. Với mỗi dòng ứng viên trong `HEADER_SEARCH_ROWS`, tìm cột trên chính dòng đó **và** trên dòng ngay bên dưới, gộp lại (cột nào tìm thấy ở dòng nào cũng được, mỗi trường lấy lần khớp đầu tiên).
2. Dòng tiêu đề được chấp nhận khi gộp xong đủ các trường bắt buộc (`phone`, `route`, `date`). Nếu phát hiện ĐẦU/GIỮA/CUỐI/SỐ GHẾ nằm ở dòng dưới thì dữ liệu bắt đầu **sau dòng đó**, không phải ngay sau dòng trên.
3. File chỉ có một dòng tiêu đề (cách cũ) vẫn chạy y như trước, kể cả khi dòng bên dưới là dữ liệu.
4. Ô gộp: giá trị tiêu đề "VỊ TRÍ" không cần nhận, chỉ cần không làm hỏng việc tìm cột.
5. So khớp tên cột vẫn dùng `normalizeKey` (không phân biệt hoa/thường, dấu, khoảng trắng).

**Kiểm tra:** `npx vitest run order-import` trong `backend`.

## Task 2: Chỉ đọc 13 cột cần thiết

- [x] Đã hoàn thành: Thu gọn chỉ đọc đúng 13 cột; bỏ hoàn toàn việc đọc và báo lỗi các cột tiền, NV, điểm đón/trả, trạng thái; bỏ logic cắt bên phải cột ghi chú.

**Yêu cầu**
1. Chỉ đọc các trường: `entryDate` (Ngày vào sổ), `customer` (Tên khách), `phone`, `route` (Tuyến đi), `time` (Giờ đi), `date` (Ngày khởi hành), `vehicle` (Loại hình), `front`, `middle`, `back`, `seats` (Số ghế), `partner` (Đối tác), `note` (Ghi chú).
2. **Không đọc và không báo lỗi** cho các cột: NV, Giá nhập, Giá bán, Thành tiền xvip, Đã cọc, Nhờ thu, Lãi/Hoa hồng, Điểm đón, Điểm trả, Trạng thái. Trong `ImportRow`, các trường tiền để 0, `staffName`, `pickupPoint`, `dropoffPoint` để `undefined`, `cancelled` để `false`. Không đổi kiểu `ImportRow` (service và test đang dùng).
3. Bỏ logic cắt "mọi thứ bên phải cột Ghi chú" (không còn cần, vì đã chỉ đọc đúng cột). Nếu file không có cột Ghi chú thì `note` để trống, không lỗi.
4. Giữ nguyên các quy tắc cũ: bắt buộc SĐT, tuyến, ngày khởi hành, giờ đi, và ít nhất một trong số ghế/đầu/giữa/cuối; tên khách viết hoa chữ cái đầu mỗi từ; bỏ qua dòng trống và dòng tổng kết.
5. Ngày vào sổ thiếu thì dùng ngày hôm nay (đã làm ở service, không đổi).

**Kiểm tra:** `npx vitest run order-import` trong `backend`.

## Task 3: Test và hoàn thiện

- [x] Đã hoàn thành: Thêm `order-import.parser.spec.ts` kiểm tra tiêu đề hai tầng với ô gộp, tiêu đề một tầng, cột tiền rác, thiếu ghi chú và thiếu ghế; `tsc` không có lỗi mới; toàn bộ 14 test suite (72 tests) qua.

**Yêu cầu**
1. Thêm test cho parser (`order-import.parser.spec.ts` hoặc file spec sẵn có), tạo workbook trong test bằng `exceljs`, không dùng file ngoài:
   - tiêu đề hai tầng như mô tả ở trên, có ô gộp "VỊ TRÍ", chữ hoa/thường lẫn lộn;
   - tiêu đề một tầng (cách cũ) vẫn qua;
   - cột tiền chứa chữ rác không làm dòng lỗi;
   - thiếu cột Ghi chú không lỗi;
   - dòng thiếu số ghế vẫn báo lỗi đúng.
2. Chạy một lần: `npx tsc --noEmit` ở `backend` (chỉ được còn lỗi cũ `test/app.e2e-spec.ts` về `supertest/types`) và `npx vitest run` toàn bộ `backend`.

**Tiêu chí hoàn thành:** file mẫu hai tầng nhập được, không còn lỗi "thiếu số ghế" oan; `tsc` không thêm lỗi mới; mọi test qua.

## Ngoài phạm vi (không làm)

- Không đổi giao diện, không đổi form hay modal kết quả nhập.
- Không đổi API, DTO, entity, migration.
- Không đổi logic kiểm tra trùng lặp, đối chiếu tuyến, đối chiếu đối tác ở `orders-import.service.ts`.
- Không thêm tuyến hay đối tác mới tự động.
- Không sửa file khác ngoài parser và file test.
