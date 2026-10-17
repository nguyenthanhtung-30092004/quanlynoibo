import { MigrationInterface, QueryRunner } from 'typeorm';

/** Đổi tên đối tác viết tắt đang lưu trên đơn cũ sang tên đầy đủ (khớp bảng đối tác) */
export class RenameShortPartnerNames1710000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const renames: Array<[string[], string]> = [
      [['việt nam', 'viet nam'], 'X.E Việt Nam'],
      [['đất cảng', 'dat cang'], 'Anh Huy Đất Cảng'],
      [['anh huy'], 'Anh Huy 92'],
    ];
    for (const [shortNames, fullName] of renames) {
      await queryRunner.query(
        `UPDATE "orders" SET "partner" = $1
         WHERE lower(regexp_replace(trim("partner"), '\\s+', ' ', 'g')) = ANY($2::text[])`,
        [fullName, shortNames],
      );
    }
  }

  public async down(): Promise<void> {
    // Không hoàn tác: không biết đơn nào trước đây ghi tên viết tắt
  }
}
