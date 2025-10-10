"""
Django management command to freeze all approved orders
Usage: python manage.py freeze_approved_orders
"""
from django.core.management.base import BaseCommand
from apps.orders.models import ProductOrder
from apps.orders.services import freeze_fx_on_approval


class Command(BaseCommand):
    help = 'Freeze FX rates for all approved orders that are not yet frozen'

    def handle(self, *args, **options):
        # Find all approved orders without fx_locked
        orders = ProductOrder.objects.filter(
            status='approved',
            fx_locked=False
        )
        
        total = orders.count()
        self.stdout.write(f"Found {total} approved orders without frozen FX rates")
        
        if total == 0:
            self.stdout.write(self.style.SUCCESS('✅ All approved orders already frozen!'))
            return
        
        success_count = 0
        error_count = 0
        
        for order in orders:
            try:
                self.stdout.write(f"Freezing order {order.id}...")
                freeze_fx_on_approval(str(order.id))
                success_count += 1
            except Exception as e:
                error_count += 1
                self.stdout.write(self.style.ERROR(f"Failed to freeze order {order.id}: {e}"))
        
        self.stdout.write(self.style.SUCCESS(f'\n✅ Complete!'))
        self.stdout.write(f'   Success: {success_count}')
        self.stdout.write(f'   Errors: {error_count}')
        self.stdout.write(f'   Total: {total}')
