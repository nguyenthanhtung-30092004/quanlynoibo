import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Đối tác (nhà xe, khách sạn, đơn vị tour...) dùng ở cột ĐỐI TÁC của đơn */
@Entity('partners')
export class Partner {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ unique: true, length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Hoa hồng (VNĐ) cho mỗi vé của nhà xe này; chỉ Admin được xem và sửa. 0 = chưa đặt */
  @Column({ name: 'commissionPerSeat', type: 'int', default: 0 })
  commissionPerSeat: number;

  /** Hoa hồng theo % giá vé đầy đủ (0-100); chỉ Admin được xem và sửa. 0 = chưa đặt */
  @Column({ name: 'commissionPercent', type: 'float', default: 0 })
  commissionPercent: number;

  /** Hoa hồng giao hàng theo % cước phí (0-100). 0 = chưa đặt */
  @Column({ name: 'deliveryCommissionPercent', type: 'float', default: 0 })
  deliveryCommissionPercent: number;

  /** Hoa hồng giao hàng cố định mỗi đơn (VNĐ). 0 = chưa đặt */
  @Column({ name: 'deliveryCommissionPerOrder', type: 'int', default: 0 })
  deliveryCommissionPerOrder: number;

  /** Người tạo; nhân viên chỉ được sửa/xóa bản ghi của mình trong ngày tạo */
  @Column({ name: 'createdById', type: 'int', nullable: true })
  createdById: number | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' })
  updatedAt: Date;
}
