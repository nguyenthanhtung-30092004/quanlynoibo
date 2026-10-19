import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** URGENT = Admin đăng ký nghỉ đột xuất hộ nhân viên */
export type LeaveHistoryAction = 'REGISTER' | 'CANCEL' | 'URGENT';

/** Lịch sử đăng ký / hủy nghỉ theo ngày: ai nghỉ, ai thao tác, lúc nào */
@Entity('leave_history')
export class LeaveHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_leave_history_day')
  @Column({ type: 'varchar', length: 10 })
  day: string;

  @Column({ type: 'varchar', length: 10 })
  action: LeaveHistoryAction;

  /** Người được nghỉ; lưu kèm tên để còn đọc được dù tài khoản bị xóa/đổi tên */
  @Column({ name: 'userId', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'userName', type: 'varchar', length: 100, default: '' })
  userName: string;

  /** Người thực hiện thao tác (nhân viên tự làm hoặc Admin hủy hộ) */
  @Column({ name: 'actorId', type: 'int', nullable: true })
  actorId: number | null;

  @Column({ name: 'actorName', type: 'varchar', length: 100, default: '' })
  actorName: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;
}
