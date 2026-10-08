# TÀI LIỆU ĐẶC TẢ YÊU CẦU HỆ THỐNG NỘI BỘ

## 1. Tổng quan hệ thống
Hệ thống là một phần mềm quản lý nội bộ dành cho doanh nghiệp cung cấp dịch vụ vận tải/đặt xe. Hệ thống giúp số hóa quy trình quản lý nhân viên, tạo và theo dõi đơn hàng (đặt chuyến xe), báo cáo hiệu suất (KPI) và tự động hóa việc chăm sóc khách hàng qua tin nhắn (SMS/Zalo).

## 2. Phân quyền và Nắm giữ vai trò (Roles)
Hệ thống được chia thành 2 cấp độ phân quyền chính:
*   **Quản trị viên (Admin - ví dụ: Chú Mạnh):** Có quyền cao nhất, quản lý toàn bộ nhân viên và xem được toàn bộ dữ liệu của hệ thống.
*   **Nhân viên (Staff - ví dụ: Nhân viên 1, Nhân viên 2, Nhân viên 3):** Chỉ có quyền thao tác tạo đơn, quản lý các đơn hàng do chính mình tạo ra.

## 3. Yêu cầu chức năng chi tiết (Functional Requirements)

### 3.1. Chức năng Quản lý Đơn hàng
*   **Tạo đơn hàng:** Nhân viên có thể tạo các đơn hàng (Đơn 1, Đơn 2, Đơn 3, Đơn 4...) cho khách.
*   **Luồng phê duyệt/Xem đơn:** Admin có quyền nhìn thấy và đọc chi tiết danh sách tất cả các đơn hàng do từng nhân viên tạo ra.
*   **Giới hạn thời gian (Time Lock):** Hệ thống tự động khóa tính năng tạo đơn mới trong khung giờ từ **22h00 tối đến 7h00 sáng** hôm sau.

### 3.2. Chức năng Lọc và Xuất Dữ liệu
*   **Lọc dữ liệu:** Cho phép lọc danh sách đơn hàng theo mốc thời gian.
*   **Xuất báo cáo:** Hỗ trợ tính năng xuất danh sách đơn hàng ra file Excel dựa trên nội dung đã lọc.

### 3.3. Chức năng Quản lý KPI
*   **Xem KPI:** Admin có thể xem báo cáo KPI của từng nhân viên theo ngày (số lượng đơn hoàn thành/tạo mới trong ngày).

### 3.4. Chức năng Tích hợp Gửi tin nhắn (SMS/Zalo)
*   **Gửi tin nhắn 1 chạm:** Trong chi tiết mỗi đơn hàng, tích hợp sẵn một nút bấm (nút hành động). Khi người dùng "ấn 1 cái", hệ thống sẽ tự động gửi thông tin qua SMS hoặc Zalo cho khách hàng.
*   **Mẫu tin nhắn (Template):** Hệ thống sẽ tự động điền các trường dữ liệu động ([...] ) vào mẫu tin nhắn sau:
    > "Thông tin: Quý khách đặt hàng thành công chuyến xe **[Chuyến - chuyến] [giờ]** ngày **[tự động]**. Quý khách lưu lại SĐT Tổng đài 1900 1977. Để tiện đặt xe cho lần sau. Trân Trọng!"
    *   *Trong đó:*
        *   `[Chuyến - chuyến]`: Thông tin về lộ trình/tên chuyến xe.
        *   `[giờ]`: Giờ khởi hành.
        *   `[tự động]`: Ngày tháng hệ thống tự động sinh ra dựa theo đơn.

## 4. Ghi chú thêm
*   Hệ thống cần tích hợp API của nhà cung cấp dịch vụ SMS/Zalo ZNS để tính năng gửi tin nhắn tự động hoạt động mượt mà.
*   Giao diện cần đơn giản, trực quan, đặc biệt là chức năng tạo đơn và nút gửi tin nhắn nhanh.