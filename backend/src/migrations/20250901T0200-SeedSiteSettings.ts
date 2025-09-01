import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedSiteSettings20250901T0200 implements MigrationInterface {
    name = 'SeedSiteSettings20250901T0200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🌱 Seeding site_settings for all tenants...');
        
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
            RETURNING "tenantId", key
        `);
        
        console.log(`✅ Created ${aboutResult.length} 'about' settings`);
        
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
            RETURNING "tenantId", key
        `);
        
        console.log(`✅ Created ${infoesResult.length} 'infoes' settings`);
        
        const allSettings = await queryRunner.query(`
            SELECT ss.key, t.name as tenant_name, td.domain
            FROM site_settings ss
            JOIN tenants t ON ss."tenantId" = t.id
            LEFT JOIN tenant_domains td ON t.id = td."tenantId" AND td."isPrimary" = true
            WHERE ss.key IN ('about', 'infoes')
            ORDER BY t.name, ss.key
        `);
        
        console.log('📋 Current site_settings state:');
        console.table(allSettings);
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
