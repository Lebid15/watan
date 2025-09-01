import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedSiteSettings20250901T0200 implements MigrationInterface {
    name = 'SeedSiteSettings20250901T0200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🌱 Seeding site_settings for all tenants...');
        
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
            
            console.log(`✅ Created ${aboutResult.length} 'about' settings`);
        } catch (error) {
            console.warn('⚠️ Failed to seed about settings:', error.message);
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
            
            console.log(`✅ Created ${infoesResult.length} 'infoes' settings`);
        } catch (error) {
            console.warn('⚠️ Failed to seed infoes settings:', error.message);
        }
        
        try {
            const settingsCount = await queryRunner.query(`
                SELECT COUNT(*) as count
                FROM site_settings ss
                WHERE ss.key IN ('about', 'infoes')
            `);
            
            console.log(`📋 Total site_settings records: ${settingsCount[0]?.count || 0}`);
        } catch (error) {
            console.warn('⚠️ Failed to count settings:', error.message);
        }
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
        
        console.log('🗑️ Removed default seeded site_settings');
    }
}
