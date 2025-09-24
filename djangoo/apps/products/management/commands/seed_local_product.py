from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Seed a demo product and package for a tenant; prints PRODUCT_ID and PACKAGE_ID"

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', required=True)
        parser.add_argument('--product-name', default='Demo Product')
        parser.add_argument('--package-name', default='Demo Package')
        parser.add_argument('--base-price', default='10.00')

    def handle(self, *args, **opts):
        tenant_id = opts['tenant_id']
        product_name = opts['product_name']
        package_name = opts['package_name']
        base_price = opts['base_price']
        with connection.cursor() as c:
            # create product
            c.execute(
                '''INSERT INTO product (id, "tenantId", name, "isActive")
                   VALUES (gen_random_uuid(), %s, %s, TRUE)
                   RETURNING id''',
                [tenant_id, product_name]
            )
            product_id = c.fetchone()[0]
            # create package
            c.execute(
                '''INSERT INTO product_packages (id, "tenantId", product_id, name, type, "basePrice", "isActive")
                   VALUES (gen_random_uuid(), %s, %s, %s, 'fixed', %s, TRUE)
                   RETURNING id''',
                [tenant_id, product_id, package_name, base_price]
            )
            package_id = c.fetchone()[0]
        self.stdout.write(f"PRODUCT_ID={product_id}")
        self.stdout.write(f"PACKAGE_ID={package_id}")
