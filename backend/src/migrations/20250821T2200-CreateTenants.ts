import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTenants20250821T2200 implements MigrationInterface {
    name = 'CreateTenants20250821T2200'

    public async up(queryRunner: QueryRunner): Promise<void> {
                                // Rescue: إنشاء جدول users الأساسي لو كان مفقودًا لمنع فشل ALTER
                                await queryRunner.query(`
                                    DO $$
                                    BEGIN
                                        IF NOT EXISTS (
                                            SELECT 1 FROM information_schema.tables WHERE table_name = 'users'
                                        ) THEN
                                            CREATE TABLE "users" (
                                                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                                "email" varchar(255) UNIQUE NOT NULL,
                                                "username" varchar(120) NULL,
                                                "password" varchar(255) NULL,
                                                "role" varchar(50) NULL,
                                                "isActive" boolean NOT NULL DEFAULT true,
                                                "balance" numeric(12,2) NOT NULL DEFAULT 0,
                                                "createdAt" timestamptz NOT NULL DEFAULT now(),
                                                "updatedAt" timestamptz NOT NULL DEFAULT now()
                                            );
                                            RAISE NOTICE 'Rescue created users baseline in CreateTenants migration.';
                                        END IF;
                                    END$$;
                                `);
                // ✅ إنشاء جدول tenants (إذا لم يوجد)
                await queryRunner.query(`
                        CREATE TABLE IF NOT EXISTS "tenants" (
                                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                "name" varchar NOT NULL,
                                "createdAt" timestamptz DEFAULT now(),
                                "updatedAt" timestamptz DEFAULT now()
                        );
                `);

                // ✅ users: إضافة tenantId وربطها (إن لم توجد)
                await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenantId" uuid;`);
                await queryRunner.query(`DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_tenant') THEN
                            ALTER TABLE "users" ADD CONSTRAINT "fk_users_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
                        END IF;
                    END $$;`);

                // ✅ product_orders: إضافة tenantId + فهرس + مفتاح أجنبي (آمنة)
                await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN IF NOT EXISTS "tenantId" uuid;`);
                await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_product_orders_tenant" ON "product_orders" ("tenantId");`);
                await queryRunner.query(`DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_orders_tenant') THEN
                            ALTER TABLE "product_orders" ADD CONSTRAINT "fk_product_orders_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT;
                        END IF;
                    END $$;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
                // تراجع عن product_orders (آمن)
                await queryRunner.query(`ALTER TABLE "product_orders" DROP CONSTRAINT IF EXISTS "fk_product_orders_tenant"`);
                await queryRunner.query(`DROP INDEX IF EXISTS "idx_product_orders_tenant"`);
                await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "tenantId"`);

                // تراجع عن users
                await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "fk_users_tenant"`);
                await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "tenantId"`);

                // حذف tenants
                await queryRunner.query(`DROP TABLE IF EXISTS "tenants"`);
    }
}
