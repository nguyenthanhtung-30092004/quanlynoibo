import { MigrationInterface, QueryRunner } from 'typeorm';

/** Thêm % hoa hồng theo giá vé cho đối tác (0 = chưa đặt, dùng mức cố định mỗi vé) */
export class PartnerCommissionPercent1710000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "commissionPercent" double precision NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "partners" DROP COLUMN IF EXISTS "commissionPercent"`);
  }
}
