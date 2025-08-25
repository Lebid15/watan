import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductImageMetricsSnapshot20250825T1900 implements MigrationInterface {  
  name = 'CreateProductImageMetricsSnapshot20250825T1900';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='product_image_metrics_snapshot'
      ) THEN
        CREATE TABLE product_image_metrics_snapshot (
          id BIGSERIAL PRIMARY KEY,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "customCount" INT NOT NULL,
          "catalogCount" INT NOT NULL,
          "missingCount" INT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pim_snap_created_at ON product_image_metrics_snapshot("createdAt");
      END IF;
    END $$;`);
  }
  public async down(): Promise<void> { /* forward only */ }
}
