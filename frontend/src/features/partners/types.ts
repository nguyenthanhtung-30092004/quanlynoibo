export interface Partner {
  id: number;
  name: string;
  note: string | null;
  /** Người đang xem có được sửa/xóa không (Admin, hoặc nhân viên tạo trong hôm nay) */
  canEdit?: boolean;
  /** Hoa hồng mỗi vé (VNĐ); chỉ Admin nhận được, nhân viên không có trường này */
  commissionPerSeat?: number;
  /** Hoa hồng theo % giá vé (0-100); chỉ Admin nhận được */
  commissionPercent?: number;
  /** Hoa hồng giao hàng theo % cước phí (0-100) */
  deliveryCommissionPercent?: number;
  /** Hoa hồng giao hàng cố định mỗi đơn (VNĐ) */
  deliveryCommissionPerOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerInput {
  name: string;
  note?: string;
  /** Chỉ Admin gửi; server bỏ qua nếu là nhân viên */
  commissionPerSeat?: number;
  commissionPercent?: number;
  deliveryCommissionPercent?: number;
  deliveryCommissionPerOrder?: number;
}
