import { MigrationInterface, QueryRunner } from 'typeorm';

/** Số xe cho loại hình "Xe Riêng" (không tính vào số vé) */
export class OrderVehicleCount1710000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "vehicleCount" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "vehicleCount"`);
  }
}
