from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Add debt and debt_updated_at columns to integrations table'

    def handle(self, *args, **options):
        self.stdout.write('=' * 60)
        self.stdout.write('Adding debt fields to integrations table...')
        self.stdout.write('=' * 60)
        
        with connection.cursor() as cursor:
            try:
                # Add debt column
                self.stdout.write('\n[1/4] Adding debt column...')
                cursor.execute("""
                    ALTER TABLE integrations 
                    ADD COLUMN IF NOT EXISTS debt DECIMAL(18, 3) DEFAULT 0;
                """)
                self.stdout.write(self.style.SUCCESS('  ✅ debt column added'))
                
                # Add debt_updated_at column
                self.stdout.write('\n[2/4] Adding debt_updated_at column...')
                cursor.execute("""
                    ALTER TABLE integrations 
                    ADD COLUMN IF NOT EXISTS debt_updated_at TIMESTAMP;
                """)
                self.stdout.write(self.style.SUCCESS('  ✅ debt_updated_at column added'))
                
                # Add comments
                self.stdout.write('\n[3/4] Adding column comments...')
                cursor.execute("""
                    COMMENT ON COLUMN integrations.debt IS 'الدين للمزود (خاص بـ ZNET)';
                """)
                cursor.execute("""
                    COMMENT ON COLUMN integrations.debt_updated_at IS 'تاريخ آخر تحديث للدين';
                """)
                self.stdout.write(self.style.SUCCESS('  ✅ Comments added'))
                
                # Verify
                self.stdout.write('\n[4/4] Verifying columns...')
                cursor.execute("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns 
                    WHERE table_name = 'integrations' 
                    AND column_name IN ('debt', 'debt_updated_at')
                    ORDER BY column_name;
                """)
                
                columns = cursor.fetchall()
                if columns:
                    self.stdout.write(self.style.SUCCESS('\n  ✅ Columns verified:\n'))
                    for col in columns:
                        self.stdout.write(f'    • {col[0]:20} | {col[1]:15} | Nullable: {col[2]}')
                else:
                    self.stdout.write(self.style.ERROR('  ❌ Columns not found!'))
                
                self.stdout.write('\n' + '=' * 60)
                self.stdout.write(self.style.SUCCESS('✅ Migration completed successfully!'))
                self.stdout.write('=' * 60)
                self.stdout.write('\nYou can now restart your Django server.')
                
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'\n❌ Error: {e}'))
                raise
