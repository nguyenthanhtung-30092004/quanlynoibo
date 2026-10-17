import { MigrationInterface, QueryRunner } from 'typeorm';

/** Đơn cũ ghi đối tác viết tắt "HK" / "G8" -> tên đầy đủ */
export class RenameHkAndG81710000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cập nhật có thể lâu hơn giới hạn 10 giây của kết nối thường
    await queryRunner.query(`SET LOCAL statement_timeout = 0`);
    // "partnerKey" là cột chuẩn hóa (chữ thường, bỏ khoảng trắng đầu/cuối) đã có index
    await queryRunner.query(`UPDATE "orders" SET "partner" = 'HK Buslines' WHERE "partnerKey" = 'hk'`);
    await queryRunner.query(`UPDATE "orders" SET "partner" = 'G8 OPEN TOUR' WHERE "partnerKey" = 'g8'`);
  }

  public async down(): Promise<void> {
    // Không hoàn tác: không biết đơn nào trước đây ghi tên viết tắt
  }
}
