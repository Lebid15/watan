from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal

from apps.products.models import Product, ProductPackage


GLOBAL_ID = '00000000-0000-0000-0000-000000000000'


class Command(BaseCommand):
    help = "Seed a few sample global products with packages into the shared catalog (tenantId = ZERO UUID)."

    def handle(self, *args, **options):
        existing = Product.objects.filter(tenant_id=GLOBAL_ID).count()
        if existing > 0:
            self.stdout.write(self.style.WARNING(f"Global products already exist ({existing}), skipping seed"))
            return

        sample = [
            {
                'name': 'بطاقة جوجل بلاي',
                'packages': [
                    {'name': '10 دولار', 'public_code': 1001, 'base_price': Decimal('10'), 'capital': Decimal('9')},
                    {'name': '25 دولار', 'public_code': 1002, 'base_price': Decimal('25'), 'capital': Decimal('23')},
                    {'name': '50 دولار', 'public_code': 1003, 'base_price': Decimal('50'), 'capital': Decimal('48')},
                ],
            },
            {
                'name': 'بطاقة آيتونز',
                'packages': [
                    {'name': '15 دولار', 'public_code': 1004, 'base_price': Decimal('15'), 'capital': Decimal('14')},
                    {'name': '30 دولار', 'public_code': 1005, 'base_price': Decimal('30'), 'capital': Decimal('28')},
                ],
            },
            {
                'name': 'شحن موبايلي',
                'packages': [
                    {'name': '20 ريال', 'public_code': 1006, 'base_price': Decimal('20'), 'capital': Decimal('19')},
                    {'name': '50 ريال', 'public_code': 1007, 'base_price': Decimal('50'), 'capital': Decimal('48')},
                    {'name': '100 ريال', 'public_code': 1008, 'base_price': Decimal('100'), 'capital': Decimal('96')},
                ],
            },
            {
                'name': 'شحن STC',
                'packages': [
                    {'name': '25 ريال', 'public_code': 1009, 'base_price': Decimal('25'), 'capital': Decimal('24')},
                    {'name': '75 ريال', 'public_code': 1010, 'base_price': Decimal('75'), 'capital': Decimal('72')},
                ],
            },
            {
                'name': 'بطاقة أمازون',
                'packages': [
                    {'name': '20 دولار', 'public_code': 1011, 'base_price': Decimal('20'), 'capital': Decimal('19')},
                    {'name': '40 دولار', 'public_code': 1012, 'base_price': Decimal('40'), 'capital': Decimal('38')},
                ],
            },
        ]

        created = 0
        with transaction.atomic():
            for p in sample:
                prod = Product(tenant_id=GLOBAL_ID, name=p['name'], is_active=True)  # type: ignore[arg-type]
                prod.save(force_insert=True)
                created += 1
                for k in p['packages']:
                    pkg = ProductPackage(
                        tenant_id=GLOBAL_ID,  # type: ignore[arg-type]
                        product=prod,
                        name=k['name'],
                        public_code=k['public_code'],
                        base_price=k['base_price'],
                        capital=k['capital'],
                        is_active=True,
                    )
                    pkg.save(force_insert=True)

        self.stdout.write(self.style.SUCCESS(f"Seeded {created} global products with packages"))
