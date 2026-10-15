import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaveRegistration1710000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "leave_requests" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "day" varchar(10) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_leave_requests_user_day" ON "leave_requests" ("userId", "day");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_leave_requests_day" ON "leave_requests" ("day");`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "leave_day_limits" (
        "day" varchar(10) PRIMARY KEY,
        "maxOff" integer NOT NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_day_limits";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_requests";`);
  }
}
