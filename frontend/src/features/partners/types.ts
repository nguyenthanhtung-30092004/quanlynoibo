export interface Partner {
  id: number;
  name: string;
  note: string | null;
  /** Người đang xem có được sửa/xóa không (Admin, hoặc nhân viên tạo trong hôm nay) */
  canEdit?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerInput {
  name: string;
  note?: string;
}
