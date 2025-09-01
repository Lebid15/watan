import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedSiteSettings20250901T0200 implements MigrationInterface {
    name = 'SeedSiteSettings20250901T0200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO site_settings (id, "tenantId", key, value, "createdAt", "updatedAt")
            SELECT 
                gen_random_uuid(),
                t.id,
                'about',
                'معلومات عن الشركة',
                now(),
                now()
            FROM tenants t
            WHERE NOT EXISTS (
                SELECT 1 FROM site_settings ss 
                WHERE ss."tenantId" = t.id AND ss.key = 'about'
            )
        `);
        
        await queryRunner.query(`
            INSERT INTO site_settings (id, "tenantId", key, value, "createdAt", "updatedAt")
            SELECT 
                gen_random_uuid(),
                t.id,
                'infoes',
                'تعليمات الاستخدام',
                now(),
                now()
            FROM tenants t
            WHERE NOT EXISTS (
                SELECT 1 FROM site_settings ss 
                WHERE ss."tenantId" = t.id AND ss.key = 'infoes'
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM site_settings 
            WHERE key = 'about' AND value = 'معلومات عن الشركة'
        `);
        
        await queryRunner.query(`
            DELETE FROM site_settings 
            WHERE key = 'infoes' AND value = 'تعليمات الاستخدام'
        `);
    }
}
