import { MigrationInterface, QueryRunner } from 'typeorm';

/** Mã chấm công mặc định của nhân viên = ID tài khoản, để nhập thẳng vào máy Hikvision làm Employee ID */
export class DeviceEmployeeNoFromUserId1710000000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "deviceEmployeeNo" = "id"::text
        WHERE "deviceEmployeeNo" IS NULL AND "deletedAt" IS NULL AND "role" = 'STAFF'
          AND NOT EXISTS (SELECT 1 FROM "users" o WHERE o."deviceEmployeeNo" = "users"."id"::text)`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Không rollback: không phân biệt được mã tự gán với mã Admin đã nhập tay
  }
}
