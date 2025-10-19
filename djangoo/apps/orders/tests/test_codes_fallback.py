import os
import sys
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

BASE_DIR = Path(__file__).resolve().parents[3]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import django

django.setup()

from apps.orders import services
from apps.codes.models import CodeGroup


class _StubOrder:
    def __init__(self, order_id: str, tenant_id: str):
        self.id = order_id
        self.tenant_id = tenant_id
        self.package_id = str(uuid.uuid4())
        self.product_id = str(uuid.uuid4())
        self.status = 'pending'
        self.provider_id = None
        self.external_order_id = None
        self.external_status = None
        self.sent_at = None
        self.provider_message = None
        self.last_message = None
        self.notes: list[dict] = []
        self.quantity = 1
        self.user_identifier = 'user123'
        self.extra_field = 'extra'
        self.manual_note = None
        self.price = 10
        self.sell_price_amount = 10
        self.sell_price_currency = 'USD'
        self.package = None
        self.product = None
        self.user = None
        self.root_order_id = None
        self.provider_referans = None

    def save(self):
        return None


class CodesFallbackTests(unittest.TestCase):
    def _make_order(self) -> _StubOrder:
        return _StubOrder(str(uuid.uuid4()), str(uuid.uuid4()))

    def _make_routing(self, *, code_group_id: str | None = None, fallback_provider_id: str | None = None):
        return SimpleNamespace(
            mode='auto',
            provider_type='internal_codes',
            code_group_id=code_group_id,
            fallback_provider_id=fallback_provider_id,
            primary_provider_id=None,
        )

    def test_codes_provider_triggers_fallback_when_group_missing(self):
        order = self._make_order()
        fallback_provider_id = str(uuid.uuid4())
        routing = self._make_routing(code_group_id=str(uuid.uuid4()), fallback_provider_id=fallback_provider_id)
        orig_try_auto_dispatch = services.try_auto_dispatch

        mock_select_related = MagicMock()
        mock_select_related.get.return_value = order

        def append_note_stub(order_obj, text):
            notes = list(getattr(order_obj, 'notes', []) or [])
            notes.append({'text': text})
            order_obj.notes = notes

        with patch('apps.orders.services.ProductOrder.objects.select_related', return_value=mock_select_related), \
             patch('apps.providers.models.PackageRouting.objects.get', return_value=routing), \
             patch('apps.orders.services._append_system_note', side_effect=append_note_stub), \
             patch('apps.orders.services._write_dispatch_log'), \
             patch('apps.orders.services._log_fallback_event') as mock_log_fallback, \
             patch('apps.orders.services._auto_fallback_enabled', return_value=True), \
             patch('apps.codes.models.CodeGroup.objects.get', side_effect=CodeGroup.DoesNotExist), \
             patch('apps.orders.services.try_auto_dispatch', return_value='fallback-called') as mock_recursive:
            result = orig_try_auto_dispatch(order.id, order.tenant_id)

        self.assertEqual(result, 'fallback-called')
        mock_recursive.assert_called_once()
        args, kwargs = mock_recursive.call_args
        self.assertEqual(args[0], order.id)
        self.assertEqual(kwargs['_override_provider_id'], fallback_provider_id)
        self.assertEqual(kwargs['_fallback_origin'], f"codes:{routing.code_group_id}")
        self.assertEqual(kwargs['_fallback_reason'], 'codes_group_not_found')
        self.assertEqual(kwargs['_disable_auto_fallback'], True)
        self.assertTrue(any('AUTO_FALLBACK:' in note['text'] for note in order.notes))
        self.assertTrue(mock_log_fallback.called)
        log_kwargs = mock_log_fallback.call_args.kwargs
        self.assertEqual(log_kwargs['stage'], 'start')
        self.assertEqual(log_kwargs['reason'], 'codes_group_not_found')

    def test_codes_provider_no_fallback_when_feature_disabled(self):
        order = self._make_order()
        routing = self._make_routing(code_group_id=str(uuid.uuid4()), fallback_provider_id=str(uuid.uuid4()))
        orig_try_auto_dispatch = services.try_auto_dispatch

        mock_select_related = MagicMock()
        mock_select_related.get.return_value = order

        def append_note_stub(order_obj, text):  # pragma: no cover - defensive helper
            notes = list(getattr(order_obj, 'notes', []) or [])
            notes.append({'text': text})
            order_obj.notes = notes

        with patch('apps.orders.services.ProductOrder.objects.select_related', return_value=mock_select_related), \
             patch('apps.providers.models.PackageRouting.objects.get', return_value=routing), \
             patch('apps.orders.services._append_system_note', side_effect=append_note_stub) as mock_append, \
             patch('apps.orders.services._write_dispatch_log'), \
             patch('apps.orders.services._log_fallback_event') as mock_log_fallback, \
             patch('apps.orders.services._auto_fallback_enabled', return_value=False), \
             patch('apps.codes.models.CodeGroup.objects.get', side_effect=CodeGroup.DoesNotExist), \
             patch('apps.orders.services.try_auto_dispatch') as mock_recursive:
            mock_recursive.side_effect = AssertionError('Fallback should not run when feature disabled')
            result = orig_try_auto_dispatch(order.id, order.tenant_id)

        self.assertIsNone(result)
        mock_recursive.assert_not_called()
        mock_append.assert_not_called()
        mock_log_fallback.assert_not_called()
        self.assertEqual(order.notes, [])


if __name__ == '__main__':
    unittest.main()
