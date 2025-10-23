from __future__ import annotations

from dataclasses import dataclass
import os
import requests
from requests import Response
from typing import Any, Dict, List

DEFAULT_TIMEOUT = (5, 20)  # (connect, read) seconds


class ZnetError(Exception):
    pass


@dataclass
class ZnetCredentials:
    base_url: str | None
    kod: str | None
    sifre: str | None


class ZnetAdapter:
    def __init__(self) -> None:
        self._product_cache: Dict[str, Dict[str, Any]] = {}

    def _sim(self) -> bool:
        return str(os.getenv('DJ_ZNET_SIMULATE') or '').lower() in ('1','true','yes','on')
    def _path(self, default_name: str, env_key: str) -> str:
        # allow overriding endpoint names via env (e.g., DJ_ZNET_BALANCE_PATH)
        v = os.getenv(env_key)
        if not v:
            return default_name
        raw = v.strip()
        if not raw:
            return ''
        raw = raw.lstrip('/')
        if '/' not in raw:
            suffix = raw if raw.endswith('.php') else f"{raw}.php"
            return f"servis/{suffix}"
        return raw
    def _headers(self, creds: ZnetCredentials) -> Dict[str, str]:
        h = { 'Accept': 'application/json' }
        # Some Znet deployments use basic query params (kod/sifre) rather than headers; keep headers minimal
        return h

    def _base(self, creds: ZnetCredentials) -> str:
        base = (creds.base_url or '').rstrip('/')
        if not base:
            raise ZnetError('Missing base_url for Znet')
        return base

    def _handle(self, resp: Response) -> Any:
        try:
            resp.raise_for_status()
        except requests.HTTPError as e:
            # Try include body excerpt for diagnostics
            body = None
            try:
                body = resp.json()
            except Exception:
                body = resp.text[:500]
            raise ZnetError(f"HTTP {resp.status_code}: {body}") from e
        try:
            return resp.json()
        except ValueError:
            return resp.text

    def _auth_params(self, creds: ZnetCredentials) -> Dict[str, Any]:
        # Many Turkish reseller panels expect ?kod=...&sifre=... for auth
        out = {}
        if creds.kod:
            out['kod'] = creds.kod
        if creds.sifre:
            out['sifre'] = creds.sifre
        return out

    def get_balance(self, creds: ZnetCredentials):
        # PATCH 5.x: Remove simulation mode fallback for production
        # Simulation should only be used in development with explicit env var
        if self._sim():
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                "ZNET adapter running in SIMULATION mode - returning mock balance. "
                "Set DJ_ZNET_SIMULATE=false for production."
            )
            return { 'balance': 123.45, 'currency': 'TRY' }

        path = self._path('servis/bakiye_kontrol.php', 'DJ_ZNET_BALANCE_PATH').lstrip('/')
        if not path:
            return { 'balance': 0, 'error': 'BALANCE_UNSUPPORTED', 'message': 'No balance endpoint configured for Znet' }
        url = f"{self._base(creds)}/{path}"
        params = self._auth_params(creds)
        
        # PATCH 5.x: Sanitize sensitive data in logs
        import logging
        logger = logging.getLogger(__name__)
        safe_params = {k: '***' if k in ('kod', 'sifre', 'token', 'apiToken') else v for k, v in params.items()}
        logger.debug(f"Fetching ZNET balance from {url} with params: {safe_params}")
        
        try:
            resp = requests.get(url, headers=self._headers(creds), params=params, timeout=DEFAULT_TIMEOUT)
            resp.raise_for_status()
            body = resp.text.strip()
            if not body:
                raise ZnetError('Empty response from Znet balance endpoint')

            # Allow JSON-style responses if the provider proxy wraps it
            first_char = body[:1]
            if first_char in ('{', '['):
                try:
                    data = resp.json()
                except Exception as exc:  # pragma: no cover - defensive
                    raise ZnetError(f'Unable to parse JSON balance response: {body[:200]}') from exc

                bal = None
                debt_raw = None
                if isinstance(data, dict):
                    for key in ('balance', 'bakiye', 'Balance', 'Bakiye'):
                        if data.get(key) is not None:
                            bal = data.get(key)
                            break
                    for key in ('debt', 'borc', 'Debt', 'borc_tutar', 'borcTutar'):
                        if data.get(key) is not None:
                            debt_raw = data.get(key)
                            break
                    inner = data.get('data') if isinstance(data.get('data'), dict) else None
                    if bal is None and inner is not None:
                        for key in ('balance', 'bakiye'):
                            if inner.get(key) is not None:
                                bal = inner.get(key)
                                break
                    if debt_raw is None and inner is not None:
                        for key in ('debt', 'borc'):
                            if inner.get(key) is not None:
                                debt_raw = inner.get(key)
                                break
                if bal is None:
                    raise ZnetError(f'Balance key missing in JSON response: {str(data)[:200]}')
                try:
                    value = float(str(bal).replace(',', '.'))
                except Exception as exc:  # pragma: no cover - defensive
                    raise ZnetError('Invalid balance number in JSON response') from exc
                debt_value = None
                if debt_raw is not None:
                    try:
                        debt_value = float(str(debt_raw).replace(',', '.'))
                    except Exception:
                        debt_value = None
                return { 'balance': value, 'debt': debt_value, 'currency': 'TRY' }

            parts = [p.strip() for p in body.split('|')]
            if parts and parts[0].upper() == 'OK' and len(parts) >= 2:
                raw_value = parts[1]
                if not raw_value:
                    raise ZnetError('Missing balance field in response')
                try:
                    value = float(raw_value.replace(',', '.'))
                except Exception as exc:  # pragma: no cover - defensive
                    raise ZnetError('Invalid balance number in response') from exc
                debt_value = None
                if len(parts) >= 3:
                    raw_debt = parts[2]
                    if raw_debt:
                        try:
                            debt_value = float(raw_debt.replace(',', '.'))
                        except Exception:
                            debt_value = None
                return { 'balance': value, 'debt': debt_value, 'currency': 'TRY' }

            raise ZnetError(f'Unexpected balance response: {body[:200]}')
        except Exception as exc:
            msg = str(exc)
            return { 'balance': 0, 'debt': None, 'error': 'FETCH_FAILED', 'message': msg[:200], 'currency': 'TRY' }

    def list_products(self, creds: ZnetCredentials) -> List[Dict[str, Any]]:
        if self._sim():
            return [
                {
                    'externalId': '1001',
                    'name': 'Generic Package 1001',
                    'basePrice': 10.0,
                    'category': 'Simulated',
                    'available': True,
                    'inputParams': ['oyuncu_bilgi', 'musteri_tel'],
                    'quantity': {'type': 'none'},
                    'kind': 'package',
                    'meta': {'currency': 'TRY', 'oyun_bilgi_id': '2001', 'kupur': '1001'},
                },
                {
                    'externalId': '1002',
                    'name': 'Generic Package 1002',
                    'basePrice': 15.0,
                    'category': 'Simulated',
                    'available': True,
                    'inputParams': ['oyuncu_bilgi', 'musteri_tel'],
                    'quantity': {'type': 'none'},
                    'kind': 'package',
                    'meta': {'currency': 'TRY', 'oyun_bilgi_id': '2002', 'kupur': '1002'},
                },
            ]

        path = self._path('servis/pin_listesi.php', 'DJ_ZNET_CATALOG_PATH')
        url = f"{self._base(creds)}/{path}"
        params = self._auth_params(creds)
        print(f"[ZNET list_products] Calling: {url}")
        print(f"   - Auth params: kod={params.get('kod', 'MISSING')[:10]}..., sifre={params.get('sifre', 'MISSING')[:10]}...")
        resp = requests.get(url, headers=self._headers(creds), params=params, timeout=DEFAULT_TIMEOUT)
        print(f"   - HTTP Status: {resp.status_code}")
        data = self._handle(resp)

        if not isinstance(data, dict) or data.get('success') is not True or not isinstance(data.get('result'), list):
            raise ZnetError(f'Unexpected catalog response: {str(data)[:200]}')

        currency_fallback = 'TRY'
        products: List[Dict[str, Any]] = []
        cache: Dict[str, Dict[str, Any]] = {}

        for raw in data['result']:
            if not isinstance(raw, dict):
                continue
            external_id = raw.get('id') or raw.get('externalId') or raw.get('kupur') or raw.get('oyun_bilgi_id')
            if external_id is None:
                continue
            external_id = str(external_id)

            # Handle Unicode names safely
            raw_name = raw.get('adi') or raw.get('oyun_adi') or raw.get('name')
            if raw_name:
                try:
                    # Try to encode/decode to handle Unicode properly
                    name = str(raw_name).encode('utf-8', errors='ignore').decode('utf-8')
                except:
                    name = f'Package {external_id}'
            else:
                name = f'Package {external_id}'
            # Handle Unicode category safely
            raw_category = raw.get('oyun_adi') or raw.get('category')
            if raw_category:
                try:
                    category = str(raw_category).encode('utf-8', errors='ignore').decode('utf-8')
                except:
                    category = None
            else:
                category = None
            price_fields = ['fiyat', 'price', 'maliyet', 'bayi_maliyeti', 'bayiMaliyeti']
            base_price = None
            for field in price_fields:
                if raw.get(field) is None:
                    continue
                try:
                    base_price = float(str(raw[field]).replace(',', '.'))
                    break
                except Exception:
                    continue
            if base_price is None:
                base_price = 0.0

            currency = raw.get('para_birimi') or raw.get('currency') or raw.get('currencyCode') or currency_fallback

            meta = {
                'oyun_bilgi_id': str(raw.get('oyun_bilgi_id')) if raw.get('oyun_bilgi_id') else None,
                'kupur': str(raw.get('kupur')) if raw.get('kupur') else None,
                'currency': currency,
                'raw': raw,
            }

            product = {
                'externalId': external_id,
                'name': str(name),
                'basePrice': float(base_price),
                'category': str(category) if category else None,
                'available': True,
                'inputParams': ['oyuncu_bilgi', 'musteri_tel'],
                'quantity': {'type': 'none'},
                'kind': 'package',
                'meta': meta,
                'currencyCode': currency,
            }
            products.append(product)
            cache[external_id] = meta

        self._product_cache = cache
        return products

    def fetch_catalog(self, creds: ZnetCredentials):
        if self._sim():
            return [
                { 'productExternalId': '2001', 'productName': 'Simulated Product', 'packageExternalId': '1001', 'packageName': 'Generic Package 1001', 'costPrice': 10.0, 'currencyCode': 'TRY' },
                { 'productExternalId': '2002', 'productName': 'Simulated Product', 'packageExternalId': '1002', 'packageName': 'Generic Package 1002', 'costPrice': 15.0, 'currencyCode': 'TRY' },
            ]

        items = self.list_products(creds)
        catalog = []
        for item in items:
            meta = item.get('meta') or {}
            product_external_id = meta.get('oyun_bilgi_id') or item.get('category') or item.get('externalId')
            product_name = item.get('category') or item.get('name')
            catalog.append({
                'productExternalId': str(product_external_id) if product_external_id is not None else None,
                'productName': str(product_name) if product_name is not None else None,
                'productImageUrl': None,
                'packageExternalId': str(item.get('externalId')),
                'packageName': item.get('name'),
                'costPrice': item.get('basePrice'),
                'currencyCode': meta.get('currency') or item.get('currencyCode'),
            })
        return catalog

    def place_order(self, creds: ZnetCredentials, provider_package_id: str, payload: dict):
        if self._sim():
            referans = payload.get('referans') or payload.get('orderId') or 'ref-sim'
            return { 'externalOrderId': str(referans), 'status': 'sent', 'note': 'OK|cost=1.23|balance=111.11', 'balance': 111.11, 'cost': 1.23 }
        # POST/GET pin_ekle.php?kod&sifre&oyun={oyun_bilgi_id}&kupur={kupur}&referans={ref}&musteri_tel={tel}&oyuncu_bilgi={info}
        path = self._path('servis/pin_ekle.php', 'DJ_ZNET_ORDERS_PATH')
        url = f"{self._base(creds)}/{path}"
        params = self._auth_params(creds)
        
        # Generate numeric referans like backend does (timestamp + random)
        # Provider may not accept UUID format
        import time
        import random
        referans = str(int(time.time() * 1000)) + str(random.randint(100, 999))
        
        # Store original orderId for tracking
        original_order_id = payload.get('referans') or payload.get('orderId')
        
        if not original_order_id:
            raise ZnetError('Missing referans/orderId for Znet place_order')
        # Build query params
        # Extract oyun and kupur from payload.params (prepared by services.py)
        params_dict = payload.get('params', {})
        oyun = params_dict.get('oyun') or provider_package_id
        kupur = params_dict.get('kupur')
        
        q: Dict[str, Any] = {
            'oyun': oyun,  # oyun_bilgi_id from metadata
            'referans': referans,
        }
        if kupur is not None:
            q['kupur'] = kupur
        
        # musteri_tel = userIdentifier (الحقل الأول - يذهب لـ musteri_tel)
        musteri_tel = params_dict.get('oyuncu_bilgi') or payload.get('userIdentifier')
        if musteri_tel:
            q['musteri_tel'] = musteri_tel
        
        # oyuncu_bilgi = extraField (الحقل الثاني - يذهب لـ oyuncu_bilgi)
        oyuncu_bilgi = params_dict.get('extra') or payload.get('extraField')
        if oyuncu_bilgi:
            q['oyuncu_bilgi'] = oyuncu_bilgi
        
        print(f"[ZNET] Final request URL params:")
        print(f"   - oyun: {q.get('oyun')}")
        print(f"   - kupur: {q.get('kupur')}")
        print(f"   - oyuncu_bilgi: {q.get('oyuncu_bilgi')}")
        print(f"   - referans: {q.get('referans')} (numeric, generated)")
        print(f"   - original_order_id: {original_order_id} (UUID, for tracking)")
        print(f"   - musteri_tel: {q.get('musteri_tel')}")
        print(f"[ZNET] Auth params:")
        print(f"   - kod: {params.get('kod', 'MISSING')[:10]}... (length: {len(params.get('kod', ''))})")
        print(f"   - sifre: {params.get('sifre', 'MISSING')[:10]}... (length: {len(params.get('sifre', ''))})")
        print(f"[ZNET] Request URL: {url}")
        
        # Prefer GET to match provider doc
        r = requests.get(url, headers=self._headers(creds), params={**params, **q}, timeout=DEFAULT_TIMEOUT)
        text = self._handle(r)
        if isinstance(text, dict):
            # Provider returns text, but handle if a proxy returns JSON
            text = str(text)
        raw = str(text or '').strip()
        # Success: OK|{BAYI_MALIYETI}|{KALAN_BAKIYE}
        # Fail: 3|{AÇIKLAMA}
        parts = raw.split('|')
        status = 'failed'
        note = raw
        ext_id = str(referans)
        balance = None
        cost = None
        if parts and parts[0].upper() == 'OK':
            status = 'sent'
            if len(parts) >= 2:
                try:
                    cost = float(parts[1])
                except Exception:
                    cost = None
            if len(parts) >= 3:
                try:
                    balance = float(parts[2])
                except Exception:
                    balance = None
            note = f"OK|cost={cost}|balance={balance}"
        else:
            # Provider may return code|message (e.g., 3|Açıklama)
            note = raw
            status = 'failed'
        
        # Return original_order_id for tracking in our system
        # ✅ FIX: Always include costCurrency for Znet since all costs are in TRY
        return { 
            'externalOrderId': original_order_id,  # Use original UUID for tracking
            'providerReferans': referans,  # Store provider's numeric referans
            'status': status, 
            'note': note, 
            'balance': balance, 
            'cost': cost,
            'costCurrency': 'TRY'  # Znet always returns costs in TRY
        }

    def fetch_status(self, creds: ZnetCredentials, referans: str):
        if self._sim():
            return { 'status': 'completed', 'pinCode': 'PIN-1234-5678', 'message': 'Simulated OK', 'raw': 'OK|2|PIN-1234-5678|Done' }
        # GET pin_kontrol.php?kod&sifre&tahsilat_api_islem_id={referans}
        path = self._path('servis/pin_kontrol.php', 'DJ_ZNET_STATUS_PATH')
        url = f"{self._base(creds)}/{path}"
        params = { **self._auth_params(creds), 'tahsilat_api_islem_id': referans }
        r = requests.get(url, headers=self._headers(creds), params=params, timeout=DEFAULT_TIMEOUT)
        text = self._handle(r)
        if isinstance(text, dict):
            text = str(text)
        raw = str(text or '').strip()
        # OK|{DURUM}|{PIN}|{AÇIKLAMA}
        parts = raw.split('|')
        mapped_status = 'unknown'
        pin = None
        desc = None
        if parts and parts[0].upper() == 'OK':
            try:
                durum = str(parts[1]) if len(parts) > 1 else ''
            except Exception:
                durum = ''
            pin = parts[2] if len(parts) > 2 else None
            desc = parts[3] if len(parts) > 3 else None
            if durum == '2':
                mapped_status = 'completed'
            elif durum == '1':
                mapped_status = 'processing'
            elif durum == '3':
                mapped_status = 'failed'
        return { 'status': mapped_status, 'pinCode': pin, 'message': desc, 'raw': raw }
