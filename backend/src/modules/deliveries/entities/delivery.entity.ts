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
import { User } from '../../users/entities/user.entity.js';

/** Đơn giao hàng (gửi hàng theo xe) */
@Index(['createdAt', 'id'])
@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** Ngày vào sổ, tự động khi tạo (YYYY-MM-DD, giờ VN) */
  @Column({ name: 'entryDate', type: 'date' })
  entryDate: string;

  @Column({ name: 'createdById', type: 'int' })
  createdById: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  /** Ngày giờ giao/lấy hàng (vd "11h ngày 20/10") */
  @Index()
  @Column({ name: 'shipDate', type: 'date' })
  shipDate: string;

  @Column({ name: 'shipTime', type: 'varchar', length: 5 })
  shipTime: string;

  @Column({ name: 'senderName', type: 'varchar', length: 100, nullable: true })
  senderName: string | null;

  @Column({ name: 'senderPhone', type: 'varchar', length: 30 })
  senderPhone: string;

  @Column({ name: 'senderAddress', type: 'varchar', length: 255, nullable: true })
  senderAddress: string | null;

  @Column({ name: 'receiverName', type: 'varchar', length: 100, nullable: true })
  receiverName: string | null;

  @Column({ name: 'receiverPhone', type: 'varchar', length: 30 })
  receiverPhone: string;

  @Column({ name: 'receiverAddress', type: 'varchar', length: 255 })
  receiverAddress: string;

  /** Số lượng (kiện / thùng / túi) */
  @Column({ type: 'int', default: 1 })
  quantity: number;

  /** Loại hàng hóa (vd mỹ phẩm, thùng túi ni lông) */
  @Column({ name: 'goodsType', type: 'varchar', length: 255, nullable: true })
  goodsType: string | null;

  /** Cân nặng (kg) */
  @Column({ name: 'weightKg', type: 'float', default: 0 })
  weightKg: number;

  /** Cước phí (VNĐ) */
  @Column({ type: 'int', default: 0 })
  fee: number;

  /** Hoa hồng (VNĐ): gợi ý theo đối tác, có thể sửa tay */
  @Column({ type: 'int', default: 0 })
  commission: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  partner: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' })
  updatedAt: Date;
}
