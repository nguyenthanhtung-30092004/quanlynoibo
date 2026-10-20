export interface Delivery {
  id: number;
  entryDate: string;
  createdById: number;
  /** Ngày giờ lấy/giao hàng */
  shipDate: string;
  shipTime: string;
  senderName: string | null;
  senderPhone: string;
  senderAddress: string | null;
  receiverName: string | null;
  receiverPhone: string;
  receiverAddress: string;
  quantity: number;
  goodsType: string | null;
  weightKg: number;
  fee: number;
  commission: number;
  partner: string | null;
  note: string | null;
  /** Người đang xem có được sửa/xóa không (Admin, hoặc nhân viên tạo trong hôm nay) */
  canEdit?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryInput {
  shipDate: string;
  shipTime: string;
  senderName?: string;
  senderPhone: string;
  senderAddress?: string;
  receiverName?: string;
  receiverPhone: string;
  receiverAddress: string;
  quantity?: number;
  goodsType?: string;
  weightKg?: number;
  fee?: number;
  commission?: number;
  partner?: string;
  note?: string;
}

export interface DeliveryFilters {
  search?: string;
  page?: number;
  limit?: number;
}
