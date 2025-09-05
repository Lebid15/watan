import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientApiProductMetadata20250905T1600 implements MigrationInterface {
  name = 'ClientApiProductMetadata20250905T1600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "product_api_metadata" (
      "product_id" uuid PRIMARY KEY REFERENCES "product"("id") ON DELETE CASCADE,
      "qty_mode" varchar(10) NOT NULL DEFAULT 'null',
      "qty_fixed" integer NOT NULL DEFAULT 1,
      "qty_min" integer NULL,
      "qty_max" integer NULL,
      "qty_list" text[] NULL,
      "params_schema" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_api_metadata"`);
  }
}
