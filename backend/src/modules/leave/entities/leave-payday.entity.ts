import { Entity, PrimaryColumn } from 'typeorm';

/** Ngày nhận lương chung do Admin đánh dấu trên lịch nghỉ (VD 2026-11-10); nhân viên xem lịch là thấy */
@Entity('leave_paydays')
export class LeavePayday {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  day: string;
}
