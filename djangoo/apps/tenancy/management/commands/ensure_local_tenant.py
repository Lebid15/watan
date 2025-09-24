from django.core.management.base import BaseCommand
from django.db import connection
from apps.tenants.models import Tenant, TenantDomain
from apps.tenancy.models import Tenant as DjTenant


class Command(BaseCommand):
    help = "Ensure a tenant domain mapping exists for a given host and echo the tenant id"

    def add_arguments(self, parser):
        parser.add_argument('-H', '--host', required=True, help='Host/domain to map (e.g., localhost)')

    def handle(self, *args, **opts):
        host = (opts.get('host') or '').strip()
        if not host:
            self.stderr.write('Host is required')
            return

        # Try to find an existing domain mapping
        dom = TenantDomain.objects.filter(domain=host).order_by('-is_primary').first()
        if dom and dom.tenant_id:
            self.stdout.write(str(dom.tenant_id))
            return

        # Otherwise pick any active tenant as dev default (most setups have one)
        ten = Tenant.objects.filter(is_active=True).order_by('created_at').first()
        if ten is None:
            # As a last resort (clean DB), create a dev placeholder tenant-domain-less tenant
            # in the unmanaged tenant table via SQL and fetch it back.
            with connection.cursor() as c:
                c.execute("""
                    INSERT INTO tenant (id, name, code, "ownerUserId", "isActive")
                    VALUES (gen_random_uuid(), 'Dev Tenant', 'dev', NULL, TRUE)
                    RETURNING id
                """)
                tid = c.fetchone()[0]
            ten = Tenant.objects.get(id=tid)

        # Create the domain mapping
        with connection.cursor() as c:
            c.execute(
                """
                INSERT INTO tenant_domain (id, "tenantId", domain, type, "isPrimary", "isVerified")
                VALUES (gen_random_uuid(), %s, %s, 'subdomain', TRUE, FALSE)
                ON CONFLICT DO NOTHING
                """,
                [str(ten.id), host]
            )

        # Also create a local dj_tenants record for middleware fallback (if not exists)
        DjTenant.objects.get_or_create(host=host, defaults={'name': host, 'is_active': True})

        self.stdout.write(str(ten.id))
from django.core.management.base import BaseCommand
from apps.tenancy.models import Tenant


class Command(BaseCommand):
    help = "Ensure a local 'localhost' tenant exists and is active"

    def handle(self, *args, **options):
        obj, created = Tenant.objects.get_or_create(
            host='localhost', defaults={'name': 'Localhost', 'is_active': True}
        )
        if not obj.is_active:
            obj.is_active = True
            obj.save(update_fields=['is_active'])
        self.stdout.write(self.style.SUCCESS(f"Tenant '{obj.host}' ready (created={created})"))
