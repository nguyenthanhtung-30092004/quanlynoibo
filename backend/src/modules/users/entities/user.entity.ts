import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  /** Quản trị viên: quản lý nhân viên, xem toàn bộ dữ liệu */
  ADMIN = 'ADMIN',
  /** Nhân viên: chỉ thao tác trên đơn hàng do chính mình tạo */
  STAFF = 'STAFF',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ unique: true, length: 50 })
  username: string;

  @Column({ name: 'passwordHash', length: 255, select: false })
  passwordHash: string;

  @Column({ name: 'fullName', length: 100 })
  fullName: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  /** Số căn cước công dân (12 số) */
  @Column({
    name: 'citizenId',
    type: 'varchar',
    length: 12,
    nullable: true,
    unique: true,
  })
  citizenId: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STAFF })
  role: UserRole;

  @Column({ name: 'isActive', type: 'boolean', default: true })
  isActive: boolean;

  /** Hash (sha256) của refresh token hiện hành, không lưu token thô */
  @Column({
    name: 'refreshTokenHash',
    type: 'varchar',
    length: 64,
    nullable: true,
    select: false,
  })
  refreshTokenHash: string | null;

  @Column({ name: 'lastLoginAt', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  /** Thời điểm xóa tài khoản (xóa mềm: giữ lại bản ghi để các đơn hàng cũ vẫn gắn với nhân viên) */
  @Column({ name: 'deletedAt', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
