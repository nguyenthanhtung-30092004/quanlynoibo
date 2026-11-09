import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Ngày nhận lương cố định hằng tháng của từng nhân viên (VD: 10 = ngày 10 mỗi tháng) */
@Entity('staff_paydays')
export class StaffPayday {
  @PrimaryColumn({ name: 'userId', type: 'int' })
  userId: number;

  /** 1-31; tháng nào không có ngày đó (VD 31 vào tháng 11) thì nhận vào ngày cuối tháng */
  @Column({ name: 'dayOfMonth', type: 'int' })
  dayOfMonth: number;
}
