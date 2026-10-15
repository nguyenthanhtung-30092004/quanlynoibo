import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Giới hạn số người nghỉ do Admin chỉnh riêng cho một ngày (0 = khóa, không cho đăng ký) */
@Entity('leave_day_limits')
export class LeaveDayLimit {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  day: string;

  @Column({ name: 'maxOff', type: 'int' })
  maxOff: number;
}
