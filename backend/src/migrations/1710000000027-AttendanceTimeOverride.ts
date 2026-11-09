import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin sửa giờ vào / giờ ra của một ngày khi máy chấm công ghi chưa đúng (phút trong ngày, giờ VN).
 * Lượt quẹt gốc trong attendance_punches giữ nguyên; công được tính lại từ giờ đã sửa.
 */
export class AttendanceTimeOverride1710000000027 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "attendance_days" ADD COLUMN IF NOT EXISTS "overrideIn" smallint;`);
    await queryRunner.query(`ALTER TABLE "attendance_days" ADD COLUMN IF NOT EXISTS "overrideOut" smallint;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "attendance_days" DROP COLUMN IF EXISTS "overrideOut";`);
    await queryRunner.query(`ALTER TABLE "attendance_days" DROP COLUMN IF EXISTS "overrideIn";`);
  }
}
