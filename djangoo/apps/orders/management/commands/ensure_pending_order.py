from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Ensure a basic pending order exists for a tenant; prints ORDER_ID=<uuid>"

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', required=True)

    def handle(self, *args, **opts):
        tenant_id = opts['tenant_id']
        # Try find any product/package for tenant
        with connection.cursor() as c:
            c.execute('SELECT p.id, pp.id FROM product p JOIN product_packages pp ON pp.product_id=p.id WHERE p."tenantId"=%s AND pp."tenantId"=%s LIMIT 1', [tenant_id, tenant_id])
            row = c.fetchone()
        if not row:
            self.stderr.write('No product/package found for tenant; seed products first')
            return
        prod_id, pkg_id = row
        # Create synthetic legacy user if needed
        with connection.cursor() as c:
            c.execute('SELECT id FROM users WHERE "tenantId"=%s LIMIT 1', [tenant_id])
            urow = c.fetchone()
            if urow:
                user_id = urow[0]
            else:
                # Provide a non-null placeholder password to satisfy NOT NULL constraint
                c.execute('INSERT INTO users (id, "tenantId", email, username, password) VALUES (gen_random_uuid(), %s, %s, %s, %s) RETURNING id', [tenant_id, 'local@demo', 'local-user', ''])
                user_id = c.fetchone()[0]
        # Insert pending order
        with connection.cursor() as c:
            c.execute(
                '''INSERT INTO product_orders (id, "tenantId", "orderNo", status, "userId", "productId", "packageId", quantity, "sellPriceCurrency", "sellPriceAmount", price, "createdAt", "externalStatus")
                   VALUES (gen_random_uuid(), %s, floor(random()*1000000)::int, 'pending', %s, %s, %s, 1, 'USD', 0, 0, NOW(), 'not_sent') RETURNING id''',
                [tenant_id, user_id, prod_id, pkg_id]
            )
            oid = c.fetchone()[0]
        self.stdout.write(f"ORDER_ID={oid}")
        self.stdout.write(f"PACKAGE_ID={pkg_id}")
