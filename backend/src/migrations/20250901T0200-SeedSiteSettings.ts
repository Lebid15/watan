import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedSiteSettings20250901T0200 implements MigrationInterface {
    name = 'SeedSiteSettings20250901T0200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            const tenantCount = await queryRunner.query(`
                SELECT COUNT(*) as count FROM tenants
            `);
            
            if (!tenantCount[0]?.count || tenantCount[0].count === 0) {
                console.log('[MIGRATION] No tenants found, skipping site_settings seeding');
                return;
            }

            try {
                const aboutResult = await queryRunner.query(`
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
                console.log(`[MIGRATION] Seeded about settings for ${aboutResult.length || 0} tenants`);
            } catch (error) {
                console.warn('[MIGRATION] Failed to seed about settings:', error.message);
            }

            try {
                const infoesResult = await queryRunner.query(`
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
                console.log(`[MIGRATION] Seeded infoes settings for ${infoesResult.length || 0} tenants`);
            } catch (error) {
                console.warn('[MIGRATION] Failed to seed infoes settings:', error.message);
            }

            console.log('[MIGRATION] SeedSiteSettings completed successfully');
        } catch (error) {
            console.error('[MIGRATION] SeedSiteSettings failed:', error.message);
            console.warn('[MIGRATION] Continuing startup despite seeding failure');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.query(`
                DELETE FROM site_settings 
                WHERE key = 'about' AND value = 'معلومات عن الشركة'
            `);
            
            await queryRunner.query(`
                DELETE FROM site_settings 
                WHERE key = 'infoes' AND value = 'تعليمات الاستخدام'
            `);
            
            console.log('[MIGRATION] SeedSiteSettings rollback completed');
        } catch (error) {
            console.error('[MIGRATION] SeedSiteSettings rollback failed:', error.message);
            throw error;
        }
    }
}
