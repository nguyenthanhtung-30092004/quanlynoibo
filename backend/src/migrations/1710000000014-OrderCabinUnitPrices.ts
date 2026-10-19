import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Giá nhập / giá bán trong cabinLines đổi từ tổng tiền của dòng sang đơn giá 1 cabin.
 * Đổi các đơn đã lưu: đơn giá = tổng dòng / số lượng (làm tròn).
 */
export class OrderCabinUnitPrices1710000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "orders" o
      SET "cabinLines" = (
        SELECT jsonb_agg(
          jsonb_set(
            jsonb_set(l.line, '{costPrice}',
              to_jsonb(round((l.line->>'costPrice')::numeric / GREATEST((l.line->>'quantity')::numeric, 1))::int)),
            '{sellPrice}',
            to_jsonb(round((l.line->>'sellPrice')::numeric / GREATEST((l.line->>'quantity')::numeric, 1))::int)
          )
          ORDER BY l.idx
        )
        FROM jsonb_array_elements(o."cabinLines") WITH ORDINALITY AS l(line, idx)
      )
      WHERE o."cabinLines" IS NOT NULL AND jsonb_array_length(o."cabinLines") > 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "orders" o
      SET "cabinLines" = (
        SELECT jsonb_agg(
          jsonb_set(
            jsonb_set(l.line, '{costPrice}',
              to_jsonb(((l.line->>'costPrice')::numeric * (l.line->>'quantity')::numeric)::int)),
            '{sellPrice}',
            to_jsonb(((l.line->>'sellPrice')::numeric * (l.line->>'quantity')::numeric)::int)
          )
          ORDER BY l.idx
        )
        FROM jsonb_array_elements(o."cabinLines") WITH ORDINALITY AS l(line, idx)
      )
      WHERE o."cabinLines" IS NOT NULL AND jsonb_array_length(o."cabinLines") > 0
    `);
  }
}
