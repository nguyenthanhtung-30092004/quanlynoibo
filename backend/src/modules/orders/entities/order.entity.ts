import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Route } from '../../routes/entities/route.entity.js';
import { MessageChannel } from '../messaging/message.types.js';
import { User } from '../../users/entities/user.entity.js';

/** Vị trí ghế trên xe (các cột ĐẦU / GIỮA / CUỐI trong sổ nhật ký) */
export enum SeatZone {
  FRONT = 'FRONT',
  MIDDLE = 'MIDDLE',
  BACK = 'BACK',
}

/** Loại hình "Xe Cabin": đơn có thể gồm cả cabin đơn và cabin đôi, mỗi loại một dòng chi tiết */
export const CABIN_VEHICLE_TYPE = 'Xe Cabin';

/** Loại hình "Xe Riêng": chỉ ghi số xe, không có ghế và không tính vào số vé */
export const PRIVATE_VEHICLE_TYPE = 'Xe Riêng';

/**
 * Loại hình "Gửi Hàng": đơn chở hàng hóa, không có ghế và không tính vào số vé.
 * Cước phí là giá bán; hoa hồng theo mức "giao hàng" của đối tác.
 */
export const GOODS_VEHICLE_TYPE = 'Gửi Hàng';

/** Chi tiết hàng hóa của đơn "Gửi Hàng" (người gửi là khách của đơn, điểm đón / điểm trả là địa chỉ gửi / nhận) */
export interface GoodsDetail {
  /** Loại hàng hóa (vd mỹ phẩm, thùng túi ni lông) */
  goodsType: string;
  /** Số lượng (kiện / thùng / túi) */
  quantity: number;
  weightKg: number;
  receiverName: string;
  receiverPhone: string;
}

export enum CabinKind {
  SINGLE = 'SINGLE',
  SINGLE_FLOOR1 = 'SINGLE_FLOOR1',
  DOUBLE = 'DOUBLE',
}

export const CABIN_LABELS: Record<CabinKind, string> = {
  [CabinKind.SINGLE]: 'Cabin Đơn',
  [CabinKind.SINGLE_FLOOR1]: 'Cabin Đơn Tầng 1',
  [CabinKind.DOUBLE]: 'Cabin Đôi',
};

/** Một dòng chi tiết cabin; giá nhập / giá bán là đơn giá của 1 cabin (tổng dòng = đơn giá x số lượng) */
export interface CabinLine {
  kind: CabinKind;
  quantity: number;
  costPrice: number;
  sellPrice: number;
}

/** Một dòng trong sổ "Nhật ký" */
@Index(['createdAt', 'id'])
@Index(['createdById', 'createdAt', 'id'])
@Index(['routeId', 'entryDate'])
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** NGÀY VÀO SỔ: tự động khi tạo đơn (YYYY-MM-DD, giờ VN) */
  @Index()
  @Column({ name: 'entryDate', type: 'date' })
  entryDate: string;

  /** NV: nhân viên tạo đơn, tự động theo người đăng nhập */
  @Index()
  @Column({ name: 'createdById', type: 'int' })
  createdById: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  /** TÊN KHÁCH */
  @Column({ name: 'customerName', type: 'varchar', length: 100, nullable: true })
  customerName: string | null;

  /** SỐ ĐIỆN THOẠI */
  @Index()
  @Column({ length: 15 })
  phone: string;

  /** TUYẾN ĐI: chọn từ danh mục tuyến đường */
  @Index()
  @Column({ name: 'routeId', type: 'int' })
  routeId: number;

  @ManyToOne(() => Route, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'routeId' })
  route: Route;

  /** GIỜ ĐI, định dạng HH:mm */
  @Column({ name: 'departureTime', length: 5 })
  departureTime: string;

  /** NGÀY KHỞI HÀNH, định dạng YYYY-MM-DD */
  @Index()
  @Column({ name: 'departureDate', type: 'date' })
  departureDate: string;

  /** LOẠI HÌNH (ví dụ: xe limousine 9 chỗ, xe ghép) */
  @Column({ name: 'vehicleType', type: 'varchar', length: 100, nullable: true })
  vehicleType: string | null;

  /** ĐẦU / GIỮA / CUỐI */
  @Column({ name: 'seatZone', type: 'enum', enum: SeatZone, nullable: true })
  seatZone: SeatZone | null;

  /** Số ghế đầu */
  @Column({ name: 'seatFront', type: 'int', default: 0 })
  seatFront: number;

  /** Số ghế giữa */
  @Column({ name: 'seatMiddle', type: 'int', default: 0 })
  seatMiddle: number;

  /** Số ghế cuối */
  @Column({ name: 'seatBack', type: 'int', default: 0 })
  seatBack: number;

  /** TỔNG SỐ GHẾ = đầu + giữa + cuối (số vé của đơn) */
  @Column({ name: 'seatCount', type: 'int', default: 1 })
  seatCount: number;

  /** GIÁ NHẬP (VNĐ) */
  @Column({ name: 'costPrice', type: 'int', default: 0 })
  costPrice: number;

  /** GIÁ BÁN (VNĐ) */
  @Column({ name: 'sellPrice', type: 'int', default: 0 })
  sellPrice: number;

  /**
   * Chi tiết cabin đơn / cabin đôi (chỉ có khi loại hình là "Xe Cabin").
   * Số ghế, giá nhập, giá bán của đơn luôn bằng tổng các dòng này nên báo cáo và bộ lọc không đổi.
   */
  @Column({ name: 'cabinLines', type: 'jsonb', nullable: true })
  cabinLines: CabinLine[] | null;

  /** Chi tiết hàng hóa (chỉ có khi loại hình là "Gửi Hàng") */
  @Column({ name: 'goods', type: 'jsonb', nullable: true })
  goods: GoodsDetail | null;

  /** Số xe của đơn "Xe Riêng"; các loại hình khác luôn là 0 */
  @Column({ name: 'vehicleCount', type: 'int', default: 0 })
  vehicleCount: number;

  /** ĐÃ CỌC (VNĐ) */
  @Column({ type: 'int', default: 0 })
  deposit: number;

  /** NHỜ THU (VNĐ) */
  @Column({ name: 'collectOnDelivery', type: 'int', default: 0 })
  collectOnDelivery: number;

  /** HOA HỒNG (VNĐ): nhập tay, không tự tính */
  @Column({ type: 'int', default: 0 })
  commission: number;

  /** ĐỐI TÁC */
  @Column({ type: 'varchar', length: 100, nullable: true })
  partner: string | null;

  /** ĐIỂM ĐÓN */
  @Column({ name: 'pickupPoint', type: 'varchar', length: 255, nullable: true })
  pickupPoint: string | null;

  /** ĐIỂM TRẢ */
  @Column({ name: 'dropoffPoint', type: 'varchar', length: 255, nullable: true })
  dropoffPoint: string | null;

  /** GHI CHÚ */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'smsSent', type: 'boolean', default: false })
  smsSent: boolean;

  @Column({ name: 'smsSentAt', type: 'timestamptz', nullable: true })
  smsSentAt: Date | null;

  /** Kênh đã dùng để gửi tin gần nhất (SMS hoặc Zalo) */
  @Column({ name: 'messageChannel', type: 'enum', enum: MessageChannel, nullable: true })
  messageChannel: MessageChannel | null;

  /** Mã tham chiếu của nhà cung cấp (VMG referentId) để tra trạng thái */
  @Column({ name: 'messageRefId', type: 'varchar', length: 100, nullable: true })
  messageRefId: string | null;

  /** Trạng thái tin: 0 chờ báo cáo, 1 thành công, 2 thất bại (VMG) */
  @Column({ name: 'messageStatus', type: 'int', nullable: true })
  messageStatus: number | null;

  /** Thời điểm hủy vé (khách không đặt nữa); null = vé còn hiệu lực */
  @Column({ name: 'cancelledAt', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  /** Lý do hủy vé do người hủy nhập */
  @Column({ name: 'cancelReason', type: 'varchar', length: 500, nullable: true })
  cancelReason: string | null;

  @Index()
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' })
  updatedAt: Date;

  /** Cột sinh sẵn chuẩn hóa tên đối tác: lower(trim(coalesce(partner, 'XVIP'))) */
  @Column({ name: 'partnerKey', type: 'text', insert: false, update: false, select: false, nullable: true })
  partnerKey?: string;

  /** Cột sinh sẵn chuẩn hóa tên khách: lower(trim(coalesce(customerName, 'khách lẻ'))) */
  @Column({ name: 'customerKey', type: 'text', insert: false, update: false, select: false, nullable: true })
  customerKey?: string;
}
