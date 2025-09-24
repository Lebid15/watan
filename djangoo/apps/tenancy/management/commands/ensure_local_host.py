from django.core.management.base import BaseCommand
from django.db import connection
from apps.tenants.models import Tenant, TenantDomain
from apps.tenancy.models import Tenant as DjTenant


class Command(BaseCommand):
    help = "Ensure a tenant domain mapping exists for a given host and echo the tenant id"

    def add_arguments(self, parser):
        parser.add_argument('host', help='Host/domain to map (e.g., localhost)')

    def handle(self, *args, **opts):
        host = (opts.get('host') or '').strip()
        if not host:
            self.stderr.write('Host is required')
            return

        dom = TenantDomain.objects.filter(domain=host).order_by('-is_primary').first()
        if dom and dom.tenant_id:
            self.stdout.write(str(dom.tenant_id))
            return

        ten = Tenant.objects.filter(is_active=True).order_by('created_at').first()
        if ten is None:
            with connection.cursor() as c:
                c.execute(
                    """
                    INSERT INTO tenant (id, name, code, "ownerUserId", "isActive")
                    VALUES (gen_random_uuid(), 'Dev Tenant', 'dev', NULL, TRUE)
                    RETURNING id
                    """
                )
                tid = c.fetchone()[0]
            ten = Tenant.objects.get(id=tid)

        with connection.cursor() as c:
            c.execute(
                """
                INSERT INTO tenant_domain (id, "tenantId", domain, type, "isPrimary", "isVerified")
                VALUES (gen_random_uuid(), %s, %s, 'subdomain', TRUE, FALSE)
                ON CONFLICT DO NOTHING
                """,
                [str(ten.id), host]
            )

        DjTenant.objects.get_or_create(host=host, defaults={'name': host, 'is_active': True})

        self.stdout.write(str(ten.id))
