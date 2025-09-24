from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Ensure package_mappings and package_routing for a package/provider"

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', required=True)
        parser.add_argument('--package-id', required=True)
        parser.add_argument('--provider-id', required=True)
        parser.add_argument('--provider-package-id', required=True)

    def handle(self, *args, **opts):
        tenant_id = opts['tenant_id']
        package_id = opts['package_id']
        provider_id = opts['provider_id']
        provider_package_id = opts['provider_package_id']
        with connection.cursor() as c:
            # mapping upsert
            c.execute('SELECT id FROM package_mappings WHERE "tenantId"=%s AND our_package_id=%s AND provider_api_id=%s', [tenant_id, package_id, provider_id])
            row = c.fetchone()
            if row:
                # Avoid touching timestamp columns to support schemas without them
                c.execute('UPDATE package_mappings SET provider_package_id=%s WHERE id=%s', [provider_package_id, row[0]])
            else:
                c.execute('INSERT INTO package_mappings (id, "tenantId", our_package_id, provider_api_id, provider_package_id) VALUES (gen_random_uuid(), %s, %s, %s, %s)', [tenant_id, package_id, provider_id, provider_package_id])
            # routing upsert
            c.execute('SELECT id FROM package_routing WHERE "tenantId"=%s AND package_id=%s', [tenant_id, package_id])
            row = c.fetchone()
            if row:
                c.execute('UPDATE package_routing SET mode=%s, "providerType"=%s, "primaryProviderId"=%s WHERE id=%s', ['auto', 'external', provider_id, row[0]])
            else:
                c.execute('INSERT INTO package_routing (id, "tenantId", package_id, mode, "providerType", "primaryProviderId") VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)', [tenant_id, package_id, 'auto', 'external', provider_id])
        self.stdout.write('OK')
