export interface Partner {
  id: number;
  name: string;
  note: string | null;
  /** Người đang xem có được sửa/xóa không (Admin, hoặc nhân viên tạo trong hôm nay) */
  canEdit?: boolean;
  /** Hoa hồng mỗi vé (VNĐ); chỉ Admin nhận được, nhân viên không có trường này */
  commissionPerSeat?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerInput {
  name: string;
  note?: string;
  /** Chỉ Admin gửi; server bỏ qua nếu là nhân viên */
  commissionPerSeat?: number;
}
