import { MigrationInterface, QueryRunner } from 'typeorm';

/** Thêm cột chi tiết cabin đơn / cabin đôi cho đơn có loại hình "Xe Cabin" */
export class OrderCabinLines1710000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cabinLines" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "cabinLines"`);
  }
}
