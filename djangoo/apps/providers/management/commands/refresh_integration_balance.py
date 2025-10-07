from django.core.management.base import BaseCommand, CommandError
from apps.providers.models import Integration
from apps.providers.adapters import resolve_adapter_credentials


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
        binding, creds = resolve_adapter_credentials(
            obj.provider,
            base_url=obj.base_url,
            api_token=getattr(obj, 'api_token', None),
            kod=getattr(obj, 'kod', None),
            sifre=getattr(obj, 'sifre', None),
        )
        if not binding:
            raise CommandError('No adapter for provider')
        res = binding.adapter.get_balance(creds)
        bal = res.get('balance')
        self.stdout.write(self.style.SUCCESS(f"Balance={bal}"))
