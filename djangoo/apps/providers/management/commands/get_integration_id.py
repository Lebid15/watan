from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = "Print integration id by (tenantId, name)"

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', required=True)
        parser.add_argument('--name', required=True)

    def handle(self, *args, **opts):
        with connection.cursor() as c:
            c.execute('SELECT id FROM integrations WHERE "tenantId"=%s AND name=%s', [opts['tenant_id'], opts['name']])
            row = c.fetchone()
        if not row:
            self.stderr.write('NOT_FOUND')
            raise SystemExit(1)
        self.stdout.write(f"INTEGRATION_ID={row[0]}")
