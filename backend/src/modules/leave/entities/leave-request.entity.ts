import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

/** Một lượt đăng ký nghỉ của nhân viên trong một ngày (mỗi người tối đa một lượt mỗi ngày) */
@Entity('leave_requests')
@Index('UQ_leave_requests_user_day', ['userId', 'day'], { unique: true })
@Index('IDX_leave_requests_day', ['day'])
export class LeaveRequest {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'userId', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Ngày nghỉ dạng YYYY-MM-DD (giờ Việt Nam) */
  @Column({ type: 'varchar', length: 10 })
  day: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;
}
