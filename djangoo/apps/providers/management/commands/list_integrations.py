from django.core.management.base import BaseCommand
from apps.providers.models import Integration


class Command(BaseCommand):
    help = "List integrations (id, tenant, name, provider)"

    def add_arguments(self, parser):
        parser.add_argument('--tenant-id', required=False)

    def handle(self, *args, **opts):
        qs = Integration.objects.all().order_by('created_at')
        if opts.get('tenant_id'):
            qs = qs.filter(tenant_id=opts['tenant_id'])
        for i in qs:
            self.stdout.write(f"{i.id}  tenant={i.tenant_id}  name={i.name}  provider={i.provider}  enabled={i.enabled}  baseUrl={i.base_url}")
