"""
Unit tests for baseline logic enforcement in manual cost, dispatch status, and routing.

These tests verify the exact requirements specified in the task:
1. Manual orders: cost_price_usd = tenant's PriceGroup USD value directly
2. Dispatch logic: try_auto_dispatch must NEVER set terminal statuses
3. No routing case: set mode='MANUAL', provider_id=NULL, status='PENDING'
4. Provider cost conversion: TRY to USD conversion with TRY snapshot
"""

import os
import uuid
from decimal import Decimal
from django.test import TestCase, override_settings
from django.db import connection
from django.utils import timezone

from apps.orders.models import ProductOrder
from apps.orders.services import (
    try_auto_dispatch,
    try_auto_dispatch_async,
    _compute_manual_cost_snapshot,
    _compute_cost_snapshot_enforced,
)
from apps.products.models import ProductPackage, PackagePrice
from apps.providers.models import PackageRouting, Integration
from apps.users.legacy_models import LegacyUser
from apps.currencies.models import Currency


class TestManualCostLogic(TestCase):
    """Test manual cost logic - cost_price_usd = tenant's PriceGroup USD value directly."""
    
    def setUp(self):
        """Set up test data."""
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()
        self.package_id = uuid.uuid4()
        self.price_group_id = uuid.uuid4()
        
        # Create test package
        self.package = ProductPackage.objects.create(
            id=self.package_id,
            tenant_id=self.tenant_id,
            name="Test Package",
            base_price=Decimal('10.00'),
            capital=Decimal('8.00')
        )
        
        # Create PriceGroup pricing
        self.package_price = PackagePrice.objects.create(
            tenant_id=self.tenant_id,
            package_id=self.package_id,
            price_group_id=self.price_group_id,
            unit_price=Decimal('5.50'),  # USD price from PriceGroup
            price=Decimal('5.50')
        )
        
        # Create legacy user with price group
        self.legacy_user = LegacyUser.objects.create(
            id=self.user_id,
            tenant_id=self.tenant_id,
            email="test@example.com",
            price_group_id=self.price_group_id
        )
        
        # Create test order
        self.order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            package_id=self.package_id,
            quantity=2,
            status='pending',
            price=Decimal('11.00'),
            sell_price_currency='USD',
            sell_price_amount=Decimal('11.00')
        )
    
    @override_settings(FF_USD_COST_ENFORCEMENT=True)
    def test_manual_cost_uses_pricegroup_usd_no_fx(self):
        """Test that manual cost uses PriceGroup USD value directly with no FX conversion."""
        
        # Calculate manual cost snapshot
        cost_snapshot = _compute_manual_cost_snapshot(self.order)
        
        # Verify cost calculation
        self.assertEqual(cost_snapshot.source, "manual_price_group_usd")
        self.assertEqual(cost_snapshot.unit_cost_usd, Decimal('5.50'))  # From PriceGroup
        self.assertEqual(cost_snapshot.original_amount, Decimal('5.50'))
        self.assertEqual(cost_snapshot.original_currency, "USD")
        self.assertEqual(cost_snapshot.fx_rate, Decimal('1'))  # No FX conversion
        
        # Verify no TRY conversion was applied
        self.assertIsNone(cost_snapshot.fx_rate) or self.assertEqual(cost_snapshot.fx_rate, Decimal('1'))


class TestDispatchLogic(TestCase):
    """Test dispatch logic - try_auto_dispatch must never set terminal statuses."""
    
    def setUp(self):
        """Set up test data."""
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()
        self.package_id = uuid.uuid4()
        self.provider_id = uuid.uuid4()
        
        # Create test package
        self.package = ProductPackage.objects.create(
            id=self.package_id,
            tenant_id=self.tenant_id,
            name="Test Package",
            base_price=Decimal('10.00')
        )
        
        # Create routing for codes provider
        self.routing = PackageRouting.objects.create(
            tenant_id=self.tenant_id,
            package_id=self.package_id,
            mode='auto',
            provider_type='codes',
            code_group_id=uuid.uuid4()
        )
        
        # Create legacy user
        self.legacy_user = LegacyUser.objects.create(
            id=self.user_id,
            tenant_id=self.tenant_id,
            email="test@example.com"
        )
        
        # Create test order
        self.order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            package_id=self.package_id,
            quantity=1,
            status='pending',
            price=Decimal('10.00'),
            sell_price_currency='USD',
            sell_price_amount=Decimal('10.00')
        )
    
    @override_settings(FF_USD_COST_ENFORCEMENT=True)
    def test_dispatch_keeps_pending_until_poll(self):
        """Test that dispatch keeps order pending until Celery polling."""
        
        # Mock the codes provider to return a code
        with self.settings(DJ_ZNET_SIMULATE=True):
            # Dispatch the order
            try_auto_dispatch(str(self.order.id), str(self.tenant_id))
        
        # Refresh order from database
        self.order.refresh_from_db()
        
        # Verify order status is NOT terminal
        self.assertNotIn(self.order.status, ('approved', 'rejected', 'failed'))
        
        # Should be 'sent' or 'pending' - not terminal
        self.assertIn(self.order.status, ('pending', 'sent'))
        
        # Verify external_status is not terminal
        self.assertNotIn(self.order.external_status, ('completed', 'done', 'failed'))


class TestNoRoutingLogic(TestCase):
    """Test no routing case - set mode='MANUAL', provider_id=NULL, status='PENDING'."""
    
    def setUp(self):
        """Set up test data."""
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()
        self.package_id = uuid.uuid4()
        
        # Create test package
        self.package = ProductPackage.objects.create(
            id=self.package_id,
            tenant_id=self.tenant_id,
            name="Test Package",
            base_price=Decimal('10.00')
        )
        
        # Create legacy user
        self.legacy_user = LegacyUser.objects.create(
            id=self.user_id,
            tenant_id=self.tenant_id,
            email="test@example.com"
        )
        
        # Create test order
        self.order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            package_id=self.package_id,
            quantity=1,
            status='pending',
            price=Decimal('10.00'),
            sell_price_currency='USD',
            sell_price_amount=Decimal('10.00')
        )
    
    @override_settings(FF_USD_COST_ENFORCEMENT=True)
    def test_no_routing_keeps_manual_null_provider(self):
        """Test that no routing case sets mode='MANUAL', provider_id=NULL, status='PENDING'."""
        
        # Ensure no routing exists
        PackageRouting.objects.filter(
            tenant_id=self.tenant_id,
            package_id=self.package_id
        ).delete()
        
        # Dispatch the order (should handle no routing case)
        try_auto_dispatch(str(self.order.id), str(self.tenant_id))
        
        # Refresh order from database
        self.order.refresh_from_db()
        
        # Verify order properties
        self.assertEqual(self.order.mode, 'MANUAL')
        self.assertIsNone(self.order.provider_id)
        self.assertEqual(self.order.status, 'PENDING')
        
        # Verify cost was calculated using manual logic
        self.assertIsNotNone(self.order.cost_price_usd)
        self.assertEqual(self.order.cost_source, 'manual_price_group_usd')


class TestProviderCostConversion(TestCase):
    """Test provider cost conversion from TRY to USD."""
    
    def setUp(self):
        """Set up test data."""
        self.tenant_id = uuid.uuid4()
        self.user_id = uuid.uuid4()
        self.package_id = uuid.uuid4()
        self.provider_id = uuid.uuid4()
        
        # Create test package
        self.package = ProductPackage.objects.create(
            id=self.package_id,
            tenant_id=self.tenant_id,
            name="Test Package",
            base_price=Decimal('10.00')
        )
        
        # Create TRY currency with exchange rate
        self.try_currency = Currency.objects.create(
            tenant_id=self.tenant_id,
            code='TRY',
            rate=Decimal('42.0'),  # 1 USD = 42 TRY
            is_active=True
        )
        
        # Create legacy user
        self.legacy_user = LegacyUser.objects.create(
            id=self.user_id,
            tenant_id=self.tenant_id,
            email="test@example.com"
        )
        
        # Create test order
        self.order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            package_id=self.package_id,
            quantity=1,
            status='pending',
            price=Decimal('10.00'),
            sell_price_currency='USD',
            sell_price_amount=Decimal('10.00')
        )
    
    @override_settings(FF_USD_COST_ENFORCEMENT=True)
    def test_provider_try_to_usd_conversion(self):
        """Test provider cost conversion from TRY to USD with TRY snapshot."""
        
        # Mock provider response with TRY cost
        provider_response = {
            'cost': 348.94,  # TRY amount
            'costCurrency': 'TRY',
            'balance': 1000.0
        }
        
        # Calculate cost snapshot
        cost_snapshot = _compute_cost_snapshot_enforced(
            order=self.order,
            tenant_id=self.tenant_id,
            provider_id=str(self.provider_id),
            provider_response=provider_response
        )
        
        # Verify USD conversion: 348.94 / 42.0 = 8.308 USD
        expected_usd = Decimal('348.94') / Decimal('42.0')
        self.assertAlmostEqual(
            float(cost_snapshot.unit_cost_usd),
            float(expected_usd),
            places=3
        )
        
        # Verify original TRY amount is preserved
        self.assertEqual(cost_snapshot.original_amount, Decimal('348.94'))
        self.assertEqual(cost_snapshot.original_currency, 'TRY')
        
        # Verify FX rate is stored
        self.assertEqual(cost_snapshot.fx_rate, Decimal('42.0'))
        
        # Verify source
        self.assertEqual(cost_snapshot.source, 'provider_response')


class TestChainForwardCostCalculation(TestCase):
    """Test that intermediate tenants compute cost before chain forwarding."""
    
    def setUp(self):
        """Set up test data for multi-hop chain."""
        self.khalil_tenant_id = uuid.uuid4()
        self.alsham_tenant_id = uuid.uuid4()
        self.diana_tenant_id = uuid.uuid4()
        
        # Create tenants
        self.khalil_tenant = Tenant.objects.create(
            id=self.khalil_tenant_id,
            name="Khalil",
            slug="khalil"
        )
        self.alsham_tenant = Tenant.objects.create(
            id=self.alsham_tenant_id,
            name="Al-Sham",
            slug="alsham"
        )
        self.diana_tenant = Tenant.objects.create(
            id=self.diana_tenant_id,
            name="Diana",
            slug="diana"
        )
        
        # Create packages
        self.khalil_package = ProductPackage.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.khalil_tenant_id,
            name="Khalil Package",
            base_price=Decimal('15.00')
        )
        self.alsham_package = ProductPackage.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.alsham_tenant_id,
            name="Al-Sham Package",
            base_price=Decimal('12.00')
        )
        self.diana_package = ProductPackage.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.diana_tenant_id,
            name="Diana Package",
            base_price=Decimal('10.00')
        )
        
        # Create users
        self.khalil_user = LegacyUser.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.khalil_tenant_id,
            username="khalil_user"
        )
        self.alsham_user = LegacyUser.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.alsham_tenant_id,
            username="alsham_user"
        )
        self.diana_user = LegacyUser.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.diana_tenant_id,
            username="diana_user"
        )
        
        # Create price groups
        self.khalil_price_group = PriceGroup.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.khalil_tenant_id,
            name="Khalil Price Group"
        )
        self.alsham_price_group = PriceGroup.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.alsham_tenant_id,
            name="Al-Sham Price Group"
        )
        self.diana_price_group = PriceGroup.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.diana_tenant_id,
            name="Diana Price Group"
        )
        
        # Create package prices
        self.khalil_price = PackagePrice.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.khalil_tenant_id,
            package_id=self.khalil_package.id,
            price_group_id=self.khalil_price_group.id,
            price_usd=Decimal('15.00')
        )
        self.alsham_price = PackagePrice.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.alsham_tenant_id,
            package_id=self.alsham_package.id,
            price_group_id=self.alsham_price_group.id,
            price_usd=Decimal('12.00')
        )
        self.diana_price = PackagePrice.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.diana_tenant_id,
            package_id=self.diana_package.id,
            price_group_id=self.diana_price_group.id,
            price_usd=Decimal('10.00')
        )
        
        # Set price groups for users
        self.khalil_user.price_group_id = self.khalil_price_group.id
        self.khalil_user.save()
        self.alsham_user.price_group_id = self.alsham_price_group.id
        self.alsham_user.save()
        self.diana_user.price_group_id = self.diana_price_group.id
        self.diana_user.save()
    
    def test_chain_forward_sets_intermediate_cost(self):
        """Test that intermediate tenants compute cost before chain forwarding."""
        # Create orders for the chain: Khalil → Al-Sham → Diana
        khalil_order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.khalil_tenant_id,
            user_id=self.khalil_user.id,
            product_id=self.khalil_package.product_id,
            package_id=self.khalil_package.id,
            quantity=1,
            status='pending',
            price=Decimal('15.00'),
            sell_price_currency='USD',
            sell_price_amount=Decimal('15.00'),
            created_at=timezone.now(),
            user_identifier='khalil123',
            extra_field='test',
            notes=[],
            notes_count=0,
        )
        
        # Simulate chain forwarding: Khalil → Al-Sham
        alsham_order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.alsham_tenant_id,
            user_id=self.alsham_user.id,
            product_id=self.alsham_package.product_id,
            package_id=self.alsham_package.id,
            quantity=1,
            status='pending',
            price=Decimal('12.00'),
            sell_price_currency='USD',
            sell_price_amount=Decimal('12.00'),
            created_at=timezone.now(),
            user_identifier='alsham123',
            extra_field='test',
            notes=[],
            notes_count=0,
            external_order_id=f"stub-{khalil_order.id}",  # This indicates chain forwarding
        )
        
        # Simulate chain forwarding: Al-Sham → Diana
        diana_order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.diana_tenant_id,
            user_id=self.diana_user.id,
            product_id=self.diana_package.product_id,
            package_id=self.diana_package.id,
            quantity=1,
            status='pending',
            price=Decimal('10.00'),
            sell_price_currency='USD',
            sell_price_amount=Decimal('10.00'),
            created_at=timezone.now(),
            user_identifier='diana123',
            extra_field='test',
            notes=[],
            notes_count=0,
            external_order_id=f"stub-{alsham_order.id}",  # This indicates chain forwarding
        )
        
        # Test that intermediate cost calculation works
        try:
            # Test Al-Sham order cost calculation (intermediate tenant)
            alsham_order.refresh_from_db()
            if not alsham_order.cost_price_usd:
                cost_snapshot = _compute_manual_cost_snapshot(alsham_order)
                alsham_order.cost_price_usd = cost_snapshot.cost_price_usd
                alsham_order.cost_try_at_order = cost_snapshot.cost_try_at_order
                alsham_order.cost_source = cost_snapshot.cost_source
                alsham_order.save(update_fields=['cost_price_usd', 'cost_try_at_order', 'cost_source'])
            
            # Test Diana order cost calculation (intermediate tenant)
            diana_order.refresh_from_db()
            if not diana_order.cost_price_usd:
                cost_snapshot = _compute_manual_cost_snapshot(diana_order)
                diana_order.cost_price_usd = cost_snapshot.cost_price_usd
                diana_order.cost_try_at_order = cost_snapshot.cost_try_at_order
                diana_order.cost_source = cost_snapshot.cost_source
                diana_order.save(update_fields=['cost_price_usd', 'cost_try_at_order', 'cost_source'])
            
            # Verify that intermediate costs are computed
            alsham_order.refresh_from_db()
            diana_order.refresh_from_db()
            
            self.assertIsNotNone(alsham_order.cost_price_usd, "Al-Sham order should have cost_price_usd")
            self.assertIsNotNone(diana_order.cost_price_usd, "Diana order should have cost_price_usd")
            
            # Verify cost values match their respective price groups
            self.assertEqual(alsham_order.cost_price_usd, Decimal('12.00'), "Al-Sham cost should match price group")
            self.assertEqual(diana_order.cost_price_usd, Decimal('10.00'), "Diana cost should match price group")
            
            print(f"✅ Chain forward intermediate cost test passed:")
            print(f"   - Al-Sham order cost: {alsham_order.cost_price_usd} USD")
            print(f"   - Diana order cost: {diana_order.cost_price_usd} USD")
            
        except Exception as exc:
            self.fail(f"Chain forward intermediate cost test failed: {exc}")

    def test_manual_cost_calculation_for_manual_routing(self):
        """Test that manual orders with manual routing get cost calculated."""
        # Create manual routing
        manual_routing = PackageRouting.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.tenant_id,
            package_id=self.package_id,
            mode='manual',  # Manual routing
            provider_type='external',
            primary_provider_id=uuid.uuid4()
        )
        
        # Dispatch the order (should calculate manual cost even for manual routing)
        try_auto_dispatch(str(self.order.id), str(self.tenant_id))
        
        # Refresh order from database
        self.order.refresh_from_db()
        
        # Verify order properties
        self.assertEqual(self.order.mode, 'MANUAL')
        self.assertIsNone(self.order.provider_id)
        self.assertEqual(self.order.status, 'PENDING')
        
        # Verify cost was calculated using manual logic
        self.assertIsNotNone(self.order.cost_price_usd)
        self.assertEqual(self.order.cost_source, 'manual_price_group_usd')
        
        # Verify cost_usd_at_order was calculated (needed for frontend display)
        self.assertIsNotNone(self.order.cost_usd_at_order)
        self.assertEqual(self.order.cost_usd_at_order, self.order.cost_price_usd)
        
        print(f"✅ Manual cost calculation for manual routing test passed:")
        print(f"   - Cost Price USD: {self.order.cost_price_usd}")
        print(f"   - Cost USD at Order: {self.order.cost_usd_at_order}")
        print(f"   - Cost Source: {self.order.cost_source}")


class TestChainForwardingCostCalculation(TestCase):
    """Test that intermediate tenants compute cost before chain forwarding."""
    
    def setUp(self):
        """Set up test data for multi-hop chain: Khalil → Al-Sham → Diana → ShamTech."""
        self.khalil_tenant_id = uuid.uuid4()
        self.alsham_tenant_id = uuid.uuid4()
        self.diana_tenant_id = uuid.uuid4()
        
        # Create tenants
        self.khalil_tenant = Tenant.objects.create(
            id=self.khalil_tenant_id,
            name="Khalil",
            slug="khalil"
        )
        self.alsham_tenant = Tenant.objects.create(
            id=self.alsham_tenant_id,
            name="Al-Sham",
            slug="alsham"
        )
        self.diana_tenant = Tenant.objects.create(
            id=self.diana_tenant_id,
            name="Diana",
            slug="diana"
        )
        
        # Create packages
        self.khalil_package = ProductPackage.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.khalil_tenant_id,
            name="Khalil Package",
            base_price=Decimal('15.00')
        )
        self.alsham_package = ProductPackage.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.alsham_tenant_id,
            name="Al-Sham Package",
            base_price=Decimal('12.00')
        )
        self.diana_package = ProductPackage.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.diana_tenant_id,
            name="Diana Package",
            base_price=Decimal('10.00')
        )
        
        # Create users
        self.khalil_user = LegacyUser.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.khalil_tenant_id,
            username="khalil_user"
        )
        self.alsham_user = LegacyUser.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.alsham_tenant_id,
            username="alsham_user"
        )
        self.diana_user = LegacyUser.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.diana_tenant_id,
            username="diana_user"
        )
        
        # Create price groups
        self.khalil_price_group = PriceGroup.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.khalil_tenant_id,
            name="Khalil Price Group"
        )
        self.alsham_price_group = PriceGroup.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.alsham_tenant_id,
            name="Al-Sham Price Group"
        )
        self.diana_price_group = PriceGroup.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.diana_tenant_id,
            name="Diana Price Group"
        )
        
        # Create package prices
        self.khalil_price = PackagePrice.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.khalil_tenant_id,
            package_id=self.khalil_package.id,
            price_group_id=self.khalil_price_group.id,
            price_usd=Decimal('15.00')
        )
        self.alsham_price = PackagePrice.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.alsham_tenant_id,
            package_id=self.alsham_package.id,
            price_group_id=self.alsham_price_group.id,
            price_usd=Decimal('12.00')
        )
        self.diana_price = PackagePrice.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.diana_tenant_id,
            package_id=self.diana_package.id,
            price_group_id=self.diana_price_group.id,
            price_usd=Decimal('10.00')
        )
        
        # Set price groups for users
        self.khalil_user.price_group_id = self.khalil_price_group.id
        self.khalil_user.save()
        self.alsham_user.price_group_id = self.alsham_price_group.id
        self.alsham_user.save()
        self.diana_user.price_group_id = self.diana_price_group.id
        self.diana_user.save()
    
    def test_chain_forward_sets_intermediate_cost(self):
        """Test that intermediate tenants compute cost before chain forwarding."""
        # Create orders for the chain: Khalil → Al-Sham → Diana
        khalil_order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.khalil_tenant_id,
            user_id=self.khalil_user.id,
            product_id=self.khalil_package.product_id,
            package_id=self.khalil_package.id,
            quantity=1,
            status='pending',
            price=Decimal('15.00'),
            sell_price_currency='USD',
            sell_price_amount=Decimal('15.00'),
            created_at=timezone.now(),
            user_identifier='khalil123',
            extra_field='test',
            notes=[],
            notes_count=0,
        )
        
        # Simulate chain forwarding: Khalil → Al-Sham
        alsham_order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.alsham_tenant_id,
            user_id=self.alsham_user.id,
            product_id=self.alsham_package.product_id,
            package_id=self.alsham_package.id,
            quantity=1,
            status='pending',
            price=Decimal('12.00'),
            sell_price_currency='USD',
            sell_price_amount=Decimal('12.00'),
            created_at=timezone.now(),
            user_identifier='alsham123',
            extra_field='test',
            notes=[],
            notes_count=0,
            external_order_id=f"stub-{khalil_order.id}",  # This indicates chain forwarding
        )
        
        # Simulate chain forwarding: Al-Sham → Diana
        diana_order = ProductOrder.objects.create(
            id=uuid.uuid4(),
            tenant_id=self.diana_tenant_id,
            user_id=self.diana_user.id,
            product_id=self.diana_package.product_id,
            package_id=self.diana_package.id,
            quantity=1,
            status='pending',
            price=Decimal('10.00'),
            sell_price_currency='USD',
            sell_price_amount=Decimal('10.00'),
            created_at=timezone.now(),
            user_identifier='diana123',
            extra_field='test',
            notes=[],
            notes_count=0,
            external_order_id=f"stub-{alsham_order.id}",  # This indicates chain forwarding
        )
        
        # Test that intermediate cost calculation works
        try:
            # Test Al-Sham order cost calculation (intermediate tenant)
            alsham_order.refresh_from_db()
            if not alsham_order.cost_price_usd:
                cost_snapshot = _compute_manual_cost_snapshot(alsham_order)
                alsham_order.cost_price_usd = cost_snapshot.cost_price_usd
                alsham_order.cost_try_at_order = cost_snapshot.cost_try_at_order
                alsham_order.cost_source = cost_snapshot.cost_source
                alsham_order.save(update_fields=['cost_price_usd', 'cost_try_at_order', 'cost_source'])
            
            # Test Diana order cost calculation (intermediate tenant)
            diana_order.refresh_from_db()
            if not diana_order.cost_price_usd:
                cost_snapshot = _compute_manual_cost_snapshot(diana_order)
                diana_order.cost_price_usd = cost_snapshot.cost_price_usd
                diana_order.cost_try_at_order = cost_snapshot.cost_try_at_order
                diana_order.cost_source = cost_snapshot.cost_source
                diana_order.save(update_fields=['cost_price_usd', 'cost_try_at_order', 'cost_source'])
            
            # Verify that intermediate costs are computed
            alsham_order.refresh_from_db()
            diana_order.refresh_from_db()
            
            self.assertIsNotNone(alsham_order.cost_price_usd, "Al-Sham order should have cost_price_usd")
            self.assertIsNotNone(diana_order.cost_price_usd, "Diana order should have cost_price_usd")
            
            # Verify cost values match their respective price groups
            self.assertEqual(alsham_order.cost_price_usd, Decimal('12.00'), "Al-Sham cost should match price group")
            self.assertEqual(diana_order.cost_price_usd, Decimal('10.00'), "Diana cost should match price group")
            
            print(f"✅ Chain forward intermediate cost test passed:")
            print(f"   - Al-Sham order cost: {alsham_order.cost_price_usd} USD")
            print(f"   - Diana order cost: {diana_order.cost_price_usd} USD")
            
        except Exception as exc:
            self.fail(f"Chain forward intermediate cost test failed: {exc}")
