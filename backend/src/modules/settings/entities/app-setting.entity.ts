import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Cài đặt hệ thống dạng khóa - giá trị (thông tin công ty, mẫu tin nhắn...) */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  key: string;

  @Column({ type: 'text', default: '' })
  value: string;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' })
  updatedAt: Date;
}
