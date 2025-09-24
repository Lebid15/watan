from django.core.management.base import BaseCommand, CommandError
from apps.providers.models import Integration
from apps.providers.adapters import get_adapter, ZnetCredentials


class Command(BaseCommand):
    help = "Refresh integration balance using provider adapter"

    def add_arguments(self, parser):
        parser.add_argument('--id', required=True, help='Integration ID (UUID)')

    def handle(self, *args, **opts):
        iid = opts['id']
        try:
            obj = Integration.objects.get(id=iid)
        except Integration.DoesNotExist:
            raise CommandError('Integration not found')
        adapter = get_adapter(obj.provider)
        if not adapter:
            raise CommandError('No adapter for provider')
        creds = ZnetCredentials(base_url=obj.base_url, kod=obj.kod, sifre=obj.sifre)
        res = adapter.get_balance(creds)
        bal = res.get('balance')
        self.stdout.write(self.style.SUCCESS(f"Balance={bal}"))
