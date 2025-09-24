from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Create an integration row (znet/apstore/barakat/internal)"

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', required=True, help='Tenant UUID')
        parser.add_argument('--name', required=True)
        parser.add_argument('--provider', required=True, choices=['barakat','apstore','znet','internal'])
        parser.add_argument('--scope', default='tenant', choices=['tenant','dev'])
        parser.add_argument('--base-url')
        parser.add_argument('--api-token')
        parser.add_argument('--kod')
        parser.add_argument('--sifre')
        parser.add_argument('--enabled', action='store_true', default=True)

    def handle(self, *args, **opts):
        with connection.cursor() as c:
            # Upsert on (tenantId, name) to be idempotent for local scripts
            c.execute(
                '''INSERT INTO integrations (id, "tenantId", name, provider, scope, "baseUrl", "apiToken", kod, sifre, enabled)
                   VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT ("tenantId", name) DO UPDATE
                     SET provider = EXCLUDED.provider,
                         scope = EXCLUDED.scope,
                         "baseUrl" = EXCLUDED."baseUrl",
                         "apiToken" = EXCLUDED."apiToken",
                         kod = EXCLUDED.kod,
                         sifre = EXCLUDED.sifre,
                         enabled = EXCLUDED.enabled
                   RETURNING id''',
                [
                    opts['tenant_id'], opts['name'], opts['provider'], opts['scope'],
                    opts.get('base_url'), opts.get('api_token'), opts.get('kod'), opts.get('sifre'), bool(opts.get('enabled', True))
                ]
            )
            row = c.fetchone()
            iid = row[0] if row else None
        self.stdout.write(self.style.SUCCESS(f"Integration created: {iid}"))
