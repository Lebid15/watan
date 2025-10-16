from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import quote

import requests

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = (5, 30)  # seconds (connect, read)


class BarakatError(Exception):
    """Raised when the Barakat/Apstore provider returns an unexpected response."""
    pass


@dataclass
class BarakatCredentials:
    base_url: Optional[str]
    api_token: Optional[str]


class BarakatAdapter:
    """Adapter for Barakat/Apstore providers."""

    def _resolve_base_url(self, creds: BarakatCredentials) -> str:
        base = (creds.base_url or '').strip()
        if not base:
            base = 'https://api.x-stor.net'
        return base.rstrip('/')

    def _headers(self, creds: BarakatCredentials) -> Dict[str, str]:
        token = (creds.api_token or '').strip()
        if not token:
            raise BarakatError('Barakat/Apstore: apiToken is required')
        return {'api-token': token}

    def _map_status(self, value: Any) -> str:
        v = str(value or '').strip().lower()
        if v in {'success', 'ok', 'done', 'complete', 'completed', 'accept'}:
            return 'success'
        if v in {'reject', 'rejected', 'failed', 'fail', 'error', 'cancelled', 'canceled'}:
            return 'failed'
        if v in {'wait', 'pending', 'processing', 'inprogress', 'queued', 'queue'}:
            return 'pending'
        return 'pending'

    def _looks_like_hard_failure(self, data: Any) -> bool:
        if not isinstance(data, dict):
            return False
        top_status = str(data.get('status') or '').upper()
        if top_status and top_status != 'OK':
            return True
        message_candidates = [
            data.get('message'),
            data.get('error'),
            data.get('desc'),
            data.get('text'),
        ]
        msg = ''
        for candidate in message_candidates:
            if isinstance(candidate, str) and candidate.strip():
                msg = candidate.lower()
                break
        if not msg:
            return False
        for keyword in (
            'insufficient balance',
            'bakiye',
            'balance',
            'not enough',
            'unauthorized',
            'invalid token',
            'missing',
            'hata',
            'error',
            'fail',
            'rejected',
        ):
            if keyword in msg:
                return True
        return False

    def _pick_note(self, obj: Any) -> Optional[str]:
        if not isinstance(obj, dict):
            return None
        replay = obj.get('replay_api')
        if isinstance(replay, list):
            for item in replay:
                if isinstance(item, str) and item.strip():
                    return item.strip()
        for key in ('note', 'message', 'desc', 'text', 'error', 'status_text', 'statusMessage'):
            value = obj.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _pick_pin(self, obj: Any) -> Optional[str]:
        if not isinstance(obj, dict):
            return None
        for key in ('pin', 'code', 'voucher', 'serial'):
            value = obj.get(key)
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return None

    def _try_json(self, resp: requests.Response) -> Any:
        try:
            return resp.json()
        except ValueError as exc:
            raise BarakatError(f'Invalid JSON response: {resp.text[:200]}') from exc

    def get_balance(self, creds: BarakatCredentials) -> Dict[str, Any]:
        url = f"{self._resolve_base_url(creds)}/client/api/profile"
        try:
            resp = requests.get(url, headers=self._headers(creds), timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            data = self._try_json(resp)
        except Exception as exc:
            msg = str(exc)
            return {'balance': 0, 'error': 'FETCH_FAILED', 'message': msg[:200]}
        bal = data.get('balance') if isinstance(data, dict) else None
        if isinstance(bal, str):
            try:
                bal = float(bal)
            except ValueError as exc:
                raise BarakatError('Invalid balance response') from exc
        elif bal is not None:
            try:
                bal = float(bal)
            except (TypeError, ValueError) as exc:
                raise BarakatError('Invalid balance response') from exc
        if bal is None:
            raise BarakatError('Balance missing in response')

        currency_value: Optional[str] = None
        debt_raw: Any = None
        containers: List[Dict[str, Any]] = []
        if isinstance(data, dict):
            containers.append(data)
            inner = data.get('data')
            if isinstance(inner, dict):
                containers.append(inner)
        for container in containers:
            for key in ('currency', 'currency_code', 'currencyCode', 'balanceCurrency', 'balance_currency'):
                value = container.get(key)
                if isinstance(value, str) and value.strip():
                    currency_value = value.strip()
                    break
            if currency_value:
                break
        for container in containers:
            for key in ('debt', 'borc', 'debit', 'balanceDebt', 'balance_debt'):
                if container.get(key) is not None:
                    debt_raw = container.get(key)
                    break
            if debt_raw is not None:
                break

        debt_value: Optional[float] = None
        if debt_raw is not None:
            try:
                debt_value = float(str(debt_raw).replace(',', '.'))
            except (TypeError, ValueError):
                debt_value = None

        result: Dict[str, Any] = {'balance': float(bal)}
        if currency_value:
            result['currency'] = currency_value
        if debt_value is not None:
            result['debt'] = debt_value
        return result

    def list_products(self, creds: BarakatCredentials) -> List[Dict[str, Any]]:
        url = f"{self._resolve_base_url(creds)}/client/api/products"
        try:
            resp = requests.get(url, headers=self._headers(creds), timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            data = self._try_json(resp)
        except Exception as exc:
            raise BarakatError(f'Failed to fetch products: {str(exc)[:200]}') from exc
        if not isinstance(data, list):
            logger.warning('Barakat list_products non-array response: %s', str(data)[:200])
            return []
        items: List[Dict[str, Any]] = []
        for raw in data:
            if not isinstance(raw, dict):
                continue
            external_id = raw.get('id')
            if external_id is None:
                continue
            external_id = str(external_id)
            name = raw.get('name') or f'Package {external_id}'
            try:
                base_price = float(raw.get('price') or 0)
            except (TypeError, ValueError):
                base_price = 0.0
            category_name = raw.get('category_name')
            category = category_name if category_name and category_name != 'null' else None
            available = bool(raw.get('available'))
            params = raw.get('params') if isinstance(raw.get('params'), list) else []
            qty_values = raw.get('qty_values')
            quantity: Dict[str, Any]
            if isinstance(qty_values, dict):
                try:
                    quantity = {
                        'type': 'range',
                        'min': float(qty_values.get('min')) if qty_values.get('min') is not None else None,
                        'max': float(qty_values.get('max')) if qty_values.get('max') is not None else None,
                    }
                except (TypeError, ValueError):
                    quantity = {'type': 'none'}
            elif isinstance(qty_values, list):
                values: List[float] = []
                for v in qty_values:
                    try:
                        values.append(float(v))
                    except (TypeError, ValueError):
                        continue
                quantity = {'type': 'set', 'values': values}
            else:
                quantity = {'type': 'none'}
            currency = raw.get('currency') or raw.get('currency_code')
            items.append({
                'externalId': external_id,
                'name': name,
                'basePrice': base_price,
                'category': category,
                'available': available,
                'inputParams': params,
                'quantity': quantity,
                'kind': raw.get('product_type') or 'package',
                'currencyCode': currency,
                'meta': {
                    'raw': raw,
                    'currency': currency,
                },
            })
        return items

    def fetch_catalog(self, creds: BarakatCredentials) -> List[Dict[str, Any]]:
        catalog: List[Dict[str, Any]] = []
        for item in self.list_products(creds):
            meta = item.get('meta') if isinstance(item.get('meta'), dict) else {}
            raw = meta.get('raw') if isinstance(meta.get('raw'), dict) else {}
            product_external_id = raw.get('product_id') or raw.get('category_id')
            catalog.append({
                'productExternalId': str(product_external_id) if product_external_id is not None else None,
                'productName': item.get('category') or item.get('name'),
                'productImageUrl': None,
                'packageExternalId': item.get('externalId'),
                'packageName': item.get('name'),
                'costPrice': item.get('basePrice'),
                'currencyCode': item.get('currencyCode') or meta.get('currency'),
            })
        return catalog

    def place_order(
        self,
        creds: BarakatCredentials,
        provider_package_id: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        base = self._resolve_base_url(creds)
        headers = self._headers(creds)
        params = {'qty': str(payload.get('qty') or payload.get('quantity') or 1)}
        extra_params = payload.get('params')
        if isinstance(extra_params, dict):
            for key, value in extra_params.items():
                params[key] = str(value)
        if payload.get('userIdentifier'):
            params['phone'] = str(payload['userIdentifier'])
        if payload.get('extraField'):
            params['extra'] = str(payload['extraField'])
        client_order_uuid = (
            payload.get('clientOrderUuid')
            or payload.get('referans')
            or payload.get('orderId')
        )
        if client_order_uuid:
            params['order_uuid'] = str(client_order_uuid)

        url = f"{base}/client/api/newOrder/{quote(str(provider_package_id))}/params"
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            try:
                data = resp.json()
            except ValueError:
                data = {'status': resp.text}
        except Exception as exc:
            return {
                'success': False,
                'mappedStatus': 'failed',
                'providerStatus': 'error',
                'status': 'failed',
                'raw': {'error': str(exc)},
            }

        ok_top = str((data or {}).get('status') or '').upper() == 'OK'
        payload_data = data.get('data') if isinstance(data, dict) else None
        provider_status = ''
        if isinstance(payload_data, dict):
            provider_status = payload_data.get('status') or ''
        if not provider_status:
            provider_status = (data or {}).get('state') or (data or {}).get('status') or ''
        mapped_status = 'failed' if self._looks_like_hard_failure(data) else self._map_status(provider_status)
        note = self._pick_note(payload_data) or self._pick_note(data)
        pin = self._pick_pin(payload_data) or self._pick_pin(data)

        if not ok_top:
            response = {
                'success': False,
                'mappedStatus': 'failed',
                'providerStatus': provider_status or (data or {}).get('status') or 'error',
                'status': 'failed',
                'raw': data,
            }
            if note:
                response['note'] = note
            return response

        try:
            price_num = float(payload_data.get('price')) if isinstance(payload_data, dict) else 0.0
        except (TypeError, ValueError):
            price_num = 0.0

        order_id_from_provider = str(
            payload_data.get('order_id')
            if isinstance(payload_data, dict) and payload_data.get('order_id') is not None
            else client_order_uuid or ''
        )
        
        response: Dict[str, Any] = {
            'success': True,
            'externalOrderId': order_id_from_provider,
            'providerReferans': order_id_from_provider,  # نفس القيمة للفحص لاحقاً
            'providerStatus': provider_status,
            'mappedStatus': mapped_status,
            'price': price_num,
            'raw': data,
            'costCurrency': 'TRY',
            'status': 'sent' if mapped_status != 'failed' else 'failed',
        }
        if note:
            response['note'] = note
        if pin:
            response['pin'] = pin
        return response

    def check_orders(self, creds: BarakatCredentials, ids: Iterable[str]) -> List[Dict[str, Any]]:
        base = self._resolve_base_url(creds)
        headers = self._headers(creds)
        clean_ids = [str(x) for x in ids if x]
        if not clean_ids:
            return []
        encoded = '[' + ','.join(clean_ids) + ']'
        url = f"{base}/client/api/check"
        
        # Check if IDs are UUIDs (contain hyphens and are 36 chars) - if so, add uuid=1
        params = {'orders': encoded}
        first_id = clean_ids[0]
        is_uuid = len(first_id) == 36 and first_id.count('-') == 4
        if is_uuid:
            params['uuid'] = '1'
            print(f"\n🌐 [Barakat] Calling check API (UUID mode):")
        else:
            print(f"\n🌐 [Barakat] Calling check API (Order ID mode):")
        
        print(f"   URL: {url}")
        print(f"   Orders param: {encoded}")
        print(f"   UUID mode: {is_uuid}")
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            data = self._try_json(resp)
            print(f"   ✅ Response received: {data}")
        except Exception as exc:
            print(f"   ❌ Error calling API: {exc}")
            raise BarakatError(f'Failed to check orders: {str(exc)[:200]}') from exc

        raw_list = data.get('data') if isinstance(data, dict) else []
        if not isinstance(raw_list, list):
            raw_list = []
        mapped: List[Dict[str, Any]] = []
        for raw in raw_list:
            if not isinstance(raw, dict):
                continue
            provider_status = raw.get('status') or raw.get('state') or raw.get('orderStatus') or ''
            mapped_status = self._map_status(provider_status)
            note = self._pick_note(raw) or self._pick_note(data if isinstance(data, dict) else None)
            pin = self._pick_pin(raw)
            mapped.append({
                'externalOrderId': str(raw.get('order_id') or ''),
                'providerStatus': provider_status,
                'mappedStatus': mapped_status,
                'raw': raw,
                'costCurrency': 'TRY',
                **({'note': note} if note else {}),
                **({'pin': pin} if pin else {}),
            })
        return mapped

    def fetch_status(self, creds: BarakatCredentials, external_order_id: str) -> Dict[str, Any]:
        print(f"\n🔍 [Barakat] Checking order status for: {external_order_id}")
        entries = self.check_orders(creds, [external_order_id])
        print(f"   📋 Entries returned: {len(entries)}")
        if entries:
            print(f"   📦 First entry: {entries[0]}")
        if not entries:
            print(f"   ⚠️ No entries found - returning 'unknown'")
            return {'status': 'unknown', 'raw': None}
        entry = entries[0]
        status = entry.get('mappedStatus')
        print(f"   📊 Mapped status from entry: {status}")
        if status == 'success':
            mapped = 'completed'
        elif status == 'failed':
            mapped = 'failed'
        elif status == 'pending':
            mapped = 'processing'
        else:
            mapped = status or 'unknown'
        print(f"   ✅ Final mapped status: {mapped}")
        result: Dict[str, Any] = {
            'status': mapped,
            'raw': entry.get('raw'),
            'message': entry.get('note'),
        }
        if entry.get('pin'):
            result['pinCode'] = entry['pin']
        return result