import { MigrationInterface, QueryRunner } from 'typeorm';

/** Đơn cũ ghi đối tác "Anh Huy MC" -> "Anh Huy 92" */
export class RenameAnhHuyMc1710000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cập nhật có thể lâu hơn giới hạn 10 giây của kết nối thường
    await queryRunner.query(`SET LOCAL statement_timeout = 0`);
    // "partnerKey" là cột chuẩn hóa (chữ thường, bỏ khoảng trắng đầu/cuối) đã có index
    await queryRunner.query(`UPDATE "orders" SET "partner" = 'Anh Huy 92' WHERE "partnerKey" = 'anh huy mc'`);
  }

  public async down(): Promise<void> {
    // Không hoàn tác: không biết đơn nào trước đây ghi "Anh Huy MC"
  }
}
