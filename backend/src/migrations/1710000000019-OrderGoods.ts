import { MigrationInterface, QueryRunner } from 'typeorm';

/** Chi tiết hàng hóa cho đơn có loại hình "Gửi Hàng" (loại hàng, số lượng, cân nặng, người nhận) */
export class OrderGoods1710000000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "goods" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "goods"`);
  }
}
