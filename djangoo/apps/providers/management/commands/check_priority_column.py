from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Check and add priority column to package_routing table'

    def handle(self, *args, **options):
        cursor = connection.cursor()
        
        # Check if priority column exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'package_routing' 
            AND column_name = 'priority';
        """)
        
        result = cursor.fetchone()
        self.stdout.write(f"Priority column exists: {bool(result)}")
        
        if not result:
            self.stdout.write("Adding priority column...")
            try:
                cursor.execute("ALTER TABLE package_routing ADD COLUMN priority INTEGER DEFAULT 1;")
                self.stdout.write(self.style.SUCCESS("Priority column added successfully!"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error adding priority column: {e}"))
        
        # Check if is_active column exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'package_routing' 
            AND column_name = 'is_active';
        """)
        
        result = cursor.fetchone()
        self.stdout.write(f"is_active column exists: {bool(result)}")
        
        if not result:
            self.stdout.write("Adding is_active column...")
            try:
                cursor.execute("ALTER TABLE package_routing ADD COLUMN is_active BOOLEAN DEFAULT true;")
                self.stdout.write(self.style.SUCCESS("is_active column added successfully!"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error adding is_active column: {e}"))
        
        # Check if created_at column exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'package_routing' 
            AND column_name = 'created_at';
        """)
        
        result = cursor.fetchone()
        self.stdout.write(f"created_at column exists: {bool(result)}")
        
        if not result:
            self.stdout.write("Adding created_at column...")
            try:
                cursor.execute("ALTER TABLE package_routing ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
                self.stdout.write(self.style.SUCCESS("created_at column added successfully!"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error adding created_at column: {e}"))
        
        # Check if updated_at column exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'package_routing' 
            AND column_name = 'updated_at';
        """)
        
        result = cursor.fetchone()
        self.stdout.write(f"updated_at column exists: {bool(result)}")
        
        if not result:
            self.stdout.write("Adding updated_at column...")
            try:
                cursor.execute("ALTER TABLE package_routing ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
                self.stdout.write(self.style.SUCCESS("updated_at column added successfully!"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error adding updated_at column: {e}"))
