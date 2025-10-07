from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Adjust unique constraint on product_packages to (tenantId, product_id, publicCode)'

    def handle(self, *args, **options):
        sql_path = 'apps/products/migrations/0001_update_unique_constraint.sql'
        try:
            with open(sql_path, 'r', encoding='utf-8') as f:
                sql = f.read()
        except FileNotFoundError:
            self.stderr.write('Migration SQL not found: %s' % sql_path)
            return
        with connection.cursor() as cur:
            cur.execute(sql)
        self.stdout.write(self.style.SUCCESS('Unique constraint updated successfully.'))
