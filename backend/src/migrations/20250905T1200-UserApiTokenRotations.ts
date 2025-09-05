import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserApiTokenRotations20250905T1200 implements MigrationInterface {
  name = 'UserApiTokenRotations20250905T1200';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "user_api_token_rotations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL,
      "oldToken" varchar(40),
      "rotatedAt" ${process.env.TEST_DB_SQLITE === 'true' ? 'datetime' : 'timestamptz'} NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_user_api_token_rot_user" ON "user_api_token_rotations" ("userId")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "user_api_token_rotations"`);
  }
}
