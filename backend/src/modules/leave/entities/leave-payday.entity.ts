import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Ngày nhận lương do Admin đánh dấu trên lịch nghỉ, kèm chú thích (VD: "Lương tháng 10") để nhân viên cùng thấy */
@Entity('leave_paydays')
export class LeavePayday {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  day: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  note: string;
}
