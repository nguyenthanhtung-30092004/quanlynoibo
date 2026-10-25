import { MigrationInterface, QueryRunner } from 'typeorm';

/** Vào muộn trừ 25.000đ mỗi phút: cập nhật cả cấu hình lương đã lưu, vì giá trị trong DB đè lên mặc định trong code */
export class LatePenalty25k1710000000021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "app_settings"
          SET "value" = jsonb_set("value"::jsonb, '{latePenaltyPerMinute}', '25000')::text
        WHERE "key" = 'payroll_config' AND "value" ~ '^\\s*\\{'`,
    );
  }

  public async down(): Promise<void> {
    // Không biết mức cũ của từng cấu hình nên không hoàn lại; Admin chỉnh được trên trang Bảng lương
  }
}
