import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaveHistory1710000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "leave_history" (
        "id" SERIAL PRIMARY KEY,
        "day" varchar(10) NOT NULL,
        "action" varchar(10) NOT NULL,
        "userId" integer,
        "userName" varchar(100) NOT NULL DEFAULT '',
        "actorId" integer,
        "actorName" varchar(100) NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_leave_history_day" ON "leave_history" ("day");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_history";`);
  }
}
