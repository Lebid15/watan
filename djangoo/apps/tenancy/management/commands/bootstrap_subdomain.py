from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.contrib.auth import get_user_model
from apps.tenants.models import TenantDomain, Tenant
from apps.tenancy.models import Tenant as DjTenant
import secrets


class Command(BaseCommand):
    help = "Bootstrap local subdomain: creates tenant_domain + dj_tenants + owner user (email/password)"

    def add_arguments(self, parser):
        parser.add_argument('--domain', required=True, help='e.g. alsham.wtn4.com or ahmad.localhost')
        parser.add_argument('--tenant-name', required=False, default=None, help='Display name for tenant (optional)')
        parser.add_argument('--email', required=True, help='Owner user email')
        parser.add_argument('--password', required=True, help='Owner user password')
        parser.add_argument('--username', required=False, default=None, help='Owner username (defaults to email local part)')

    @transaction.atomic
    def handle(self, *args, **opts):
        domain = opts['domain'].strip()
        tname = (opts.get('tenant_name') or '').strip() or domain.split('.')[0]
        email = opts['email'].strip()
        password = opts['password']
        username = (opts.get('username') or '').strip() or (email.split('@')[0])

        # 1) Ensure a real Tenant exists (primary system table)
        ten = Tenant.objects.filter(name=tname).order_by('created_at').first()
        if not ten:
            with connection.cursor() as c:
                c.execute(
                    'INSERT INTO tenant (id, name, code, "ownerUserId", "isActive") VALUES (gen_random_uuid(), %s, %s, NULL, TRUE) RETURNING id',
                    [tname, tname[:16]]
                )
                tid = c.fetchone()[0]
            ten = Tenant.objects.get(id=tid)

        # 2) Upsert tenant_domain
        with connection.cursor() as c:
            c.execute(
                'INSERT INTO tenant_domain (id, "tenantId", domain, type, "isPrimary", "isVerified") VALUES (gen_random_uuid(), %s, %s, %s, TRUE, TRUE) ON CONFLICT (domain) DO NOTHING',
                [str(ten.id), domain, 'subdomain']
            )

        # 3) Ensure dj_tenants fallback (for local dev admin)
        DjTenant.objects.get_or_create(host=domain, defaults={'name': tname, 'is_active': True})

        # 4) Create owner user in Django auth
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'is_staff': True,
                'is_superuser': True,
                'role': getattr(User, 'Roles', None).INSTANCE_OWNER if hasattr(User, 'Roles') else 'instance_owner',
            }
        )
        # Ensure flags/fields even if user existed
        user.email = email
        user.is_staff = True
        user.is_superuser = True
        if hasattr(user, 'role'):
            try:
                user.role = user.Roles.INSTANCE_OWNER  # type: ignore
            except Exception:
                user.role = 'instance_owner'  # type: ignore
        user.set_password(password)
        if getattr(user, 'api_token', None) in (None, ''):
            try:
                user.api_token = secrets.token_hex(24)  # type: ignore
            except Exception:
                pass
        user.save()

        self.stdout.write(f"TENANT_ID={ten.id}")
        self.stdout.write(f"DOMAIN={domain}")
        self.stdout.write(f"USERNAME={user.username}")
        self.stdout.write("OK")
