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

/** Một dòng trong sổ "Nhật ký" */
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

  /** SỐ GHẾ */
  @Column({ name: 'seatCount', type: 'int', default: 1 })
  seatCount: number;

  /** GIÁ NHẬP (VNĐ) */
  @Column({ name: 'costPrice', type: 'int', default: 0 })
  costPrice: number;

  /** GIÁ BÁN (VNĐ) */
  @Column({ name: 'sellPrice', type: 'int', default: 0 })
  sellPrice: number;

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

  @Index()
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' })
  updatedAt: Date;
}
