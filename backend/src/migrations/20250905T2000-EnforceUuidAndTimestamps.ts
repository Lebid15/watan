import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Updated to be more robust:
 *  - Attempts to enable pgcrypto and uuid-ossp extensions (ignores permission errors).
 *  - Falls back to uuid_generate_v4() if gen_random_uuid() not present.
 *  - Ensures DEFAULT now() on createdAt / updatedAt columns.
 *  - Safe / idempotent; only sets defaults when missing.
 */
export class EnforceUuidAndTimestamps20250905T2000 implements MigrationInterface {
  name = 'EnforceUuidAndTimestamps20250905T2000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = (queryRunner.connection as any).options.type;
    if (driver !== 'postgres') return;

    // Try enabling both extensions (ignore failures)
    await queryRunner.query(`DO $$ BEGIN
      BEGIN EXECUTE 'CREATE EXTENSION IF NOT EXISTS pgcrypto'; EXCEPTION WHEN others THEN NULL; END;
      BEGIN EXECUTE 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'; EXCEPTION WHEN others THEN NULL; END;
    END $$;`);

    // Build arrays inside SQL for atomic operations (fewer round trips)
    const uuidTargets = [
      'tenant','tenant_domain','users','deposit','currencies','site_settings','payment_method','integration','notification',
      'catalog_product','catalog_package','order_dispatch_logs','product_orders','asset','error_log','client_api_request_log',
      'client_api_stats_daily','user_api_token_rotation','audit_log','auth_token','tenant_subscription','tenant_billing_config',
      'billing_invoice','code_group','code_item','idempotency_key','tenant_api_token','passkey_credentials','recovery_codes','totp_credentials'
    ];

    for (const table of uuidTargets) {
      await queryRunner.query(`DO $$
      DECLARE v_default text; v_type text; has_gen bool; has_v4 bool; BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='id') THEN RETURN; END IF;
        SELECT column_default, data_type INTO v_default, v_type FROM information_schema.columns WHERE table_name='${table}' AND column_name='id';
        SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='gen_random_uuid') INTO has_gen;
        SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='uuid_generate_v4') INTO has_v4;
        IF v_type='uuid' AND (v_default IS NULL OR v_default='') THEN
          IF has_gen THEN
            EXECUTE 'ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()';
          ELSIF has_v4 THEN
            EXECUTE 'ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()';
          ELSE
            RAISE NOTICE 'No UUID generator function available for table ${table}';
          END IF;
        END IF;
      END $$;`);
    }

    const timeTargets: Array<[string,string]> = [
      ['tenant','createdAt'], ['tenant','updatedAt'], ['tenant_domain','createdAt'], ['tenant_domain','updatedAt'],
      ['deposit','createdAt'], ['users','createdAt'], ['site_settings','createdAt'], ['site_settings','updatedAt'],
      ['currencies','createdAt'], ['currencies','updatedAt'], ['payment_method','createdAt'], ['integration','createdAt'],
      ['notification','createdAt'], ['catalog_product','createdAt'], ['catalog_package','createdAt'], ['order_dispatch_logs','createdAt'],
      ['product_orders','createdAt'], ['asset','createdAt'], ['error_log','createdAt'], ['client_api_request_log','createdAt'],
      ['client_api_stats_daily','createdAt'], ['user_api_token_rotation','rotatedAt'], ['audit_log','createdAt'], ['auth_token','createdAt'],
      ['tenant_subscription','createdAt'], ['tenant_billing_config','createdAt'], ['billing_invoice','createdAt'], ['code_group','createdAt'],
      ['code_item','createdAt'], ['idempotency_key','createdAt'], ['tenant_api_token','createdAt'], ['passkey_credentials','created_at'],
      ['recovery_codes','created_at'], ['totp_credentials','created_at']
    ];

    for (const [table, column] of timeTargets) {
      await queryRunner.query(`DO $$
      DECLARE v_default text; v_type text; BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${column}') THEN RETURN; END IF;
        SELECT column_default, data_type INTO v_default, v_type FROM information_schema.columns WHERE table_name='${table}' AND column_name='${column}';
        IF v_type LIKE 'timestamp%' AND (v_default IS NULL OR v_default='') THEN
          EXECUTE 'ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT now()';
        END IF;
      END $$;`);
    }
  }

  public async down(): Promise<void> { /* no-op */ }
}
