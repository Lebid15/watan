from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone
from apps.orders.models import ProductOrder
from apps.providers.models import Integration
from apps.providers.adapters import get_adapter, ZnetCredentials

class Command(BaseCommand):
    help = "Poll external order statuses for orders in sent/processing and update them using provider adapters."

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=50, help='Max orders to poll per run')
        parser.add_argument('--tenant-id', type=str, default=None, help='Filter by tenant id')
        parser.add_argument('--provider-id', type=str, default=None, help='Filter by provider integration id')

    def handle(self, *args, **options):
        limit = max(1, min(int(options['limit'] or 50), 500))
        tenant_id = (options.get('tenant_id') or '').strip() or None
        provider_id = (options.get('provider_id') or '').strip() or None

        qs = ProductOrder.objects.filter(external_status__in=['sent', 'processing']).order_by('created_at')
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        if provider_id:
            qs = qs.filter(provider_id=provider_id)
        orders = list(qs[:limit])
        if not orders:
            self.stdout.write('No orders to poll')
            return

        polled = 0
        completed = 0
        failed = 0
        for o in orders:
            try:
                integ = Integration.objects.get(id=o.provider_id)
            except Integration.DoesNotExist:
                continue
            adapter = get_adapter(integ.provider)
            if not adapter:
                continue
            creds = ZnetCredentials(base_url=integ.base_url, kod=integ.kod, sifre=integ.sifre)
            try:
                res = adapter.fetch_status(creds, str(o.external_order_id))
            except Exception as e:
                # transient error; skip
                continue
            polled += 1
            new_status = res.get('status') or o.external_status
            pin = res.get('pinCode')
            msg = (res.get('message') or '')[:1000]
            raw = (res.get('raw') or '')[:250]
            o.external_status = new_status
            if pin:
                o.pin_code = pin
            o.provider_message = msg
            o.last_message = raw
            if new_status == 'completed' and o.completed_at is None:
                o.completed_at = timezone.now()
                completed += 1
            if new_status == 'failed':
                failed += 1
            try:
                o.save(update_fields=['external_status','pin_code','provider_message','last_message','completed_at'])
            except Exception:
                o.save()

        self.stdout.write(f"Polled={polled} Completed={completed} Failed={failed}")
