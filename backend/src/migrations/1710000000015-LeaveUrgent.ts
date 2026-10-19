import { MigrationInterface, QueryRunner } from 'typeorm';

/** Đánh dấu lượt nghỉ đột xuất (Admin đăng ký hộ cho nhân viên báo nghỉ ngay trong ngày) */
export class LeaveUrgent1710000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "urgent" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "urgent"`);
  }
}
