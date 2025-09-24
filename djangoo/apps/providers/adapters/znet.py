from __future__ import annotations

from dataclasses import dataclass
import os
import requests
from requests import Response
from typing import Any, Dict

DEFAULT_TIMEOUT = (5, 20)  # (connect, read) seconds


class ZnetError(Exception):
    pass


@dataclass
class ZnetCredentials:
    base_url: str | None
    kod: str | None
    sifre: str | None


class ZnetAdapter:
    def _sim(self) -> bool:
        return str(os.getenv('DJ_ZNET_SIMULATE') or '').lower() in ('1','true','yes','on')
    def _path(self, default_name: str, env_key: str) -> str:
        # allow overriding endpoint names via env (e.g., DJ_ZNET_BALANCE_PATH)
        v = os.getenv(env_key)
        if v:
            return v.lstrip('/')
        return default_name
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
        if self._sim():
            return { 'balance': 123.45 }
        # If an explicit balance path is provided, use it; otherwise, provider does not expose balance
        # and we expect balance to be updated from order responses.
        balance_path = os.getenv('DJ_ZNET_BALANCE_PATH')
        if not balance_path:
            raise ZnetError('BALANCE_UNSUPPORTED: No DJ_ZNET_BALANCE_PATH configured for Znet')
        url = f"{self._base(creds)}/{balance_path.lstrip('/')}"
        params = self._auth_params(creds)
        r = requests.get(url, headers=self._headers(creds), params=params, timeout=DEFAULT_TIMEOUT)
        data = self._handle(r)
        bal = None
        if isinstance(data, dict):
            for k in ('balance','bakiye','Balance','Bakiye'):
                if k in data:
                    bal = data.get(k)
                    break
            if bal is None and isinstance(data.get('data'), dict):
                inner = data['data']
                for k in ('balance','bakiye'):
                    if k in inner:
                        bal = inner.get(k); break
        return { 'balance': bal }

    def fetch_catalog(self, creds: ZnetCredentials):
        if self._sim():
            # Provide a small generic catalog; names are generic to rely on hint/productId filtering or direct mapping
            return [
                { 'externalId': '1001', 'name': 'Generic Package 1001', 'desc': 'Simulated', 'kupur': None, 'raw': {} },
                { 'externalId': '1002', 'name': 'Generic Package 1002', 'desc': 'Simulated', 'kupur': None, 'raw': {} },
            ]
        # GET pin_listesi.php?kod&sifre under base (/servis)
        path = self._path('servis/pin_listesi.php', 'DJ_ZNET_CATALOG_PATH')
        url = f"{self._base(creds)}/{path}"
        params = self._auth_params(creds)
        r = requests.get(url, headers=self._headers(creds), params=params, timeout=DEFAULT_TIMEOUT)
        data = self._handle(r)
        items: list[dict] = []
        if isinstance(data, dict) and data.get('success') is True and isinstance(data.get('result'), list):
            for it in data['result']:
                if not isinstance(it, dict):
                    continue
                # Provider fields of interest
                oyun_bilgi_id = it.get('oyun_bilgi_id')
                kupur = it.get('kupur')
                items.append({
                    'externalId': oyun_bilgi_id,
                    'name': it.get('adi') or it.get('oyun_adi'),
                    'desc': it.get('aciklama'),
                    'kupur': kupur,
                    'raw': it,
                })
        else:
            raise ZnetError(f"Unexpected catalog response: {data}")
        return items

    def place_order(self, creds: ZnetCredentials, provider_package_id: str, payload: dict):
        if self._sim():
            referans = payload.get('referans') or payload.get('orderId') or 'ref-sim'
            return { 'externalOrderId': str(referans), 'status': 'sent', 'note': 'OK|cost=1.23|balance=111.11', 'balance': 111.11, 'cost': 1.23 }
        # POST/GET pin_ekle.php?kod&sifre&oyun={oyun_bilgi_id}&kupur={kupur}&referans={ref}&musteri_tel={tel}&oyuncu_bilgi={info}
        path = self._path('servis/pin_ekle.php', 'DJ_ZNET_ORDERS_PATH')
        url = f"{self._base(creds)}/{path}"
        params = self._auth_params(creds)
        referans = payload.get('referans') or payload.get('orderId')
        if not referans:
            raise ZnetError('Missing referans/orderId for Znet place_order')
        # Build query params
        q: Dict[str, Any] = {
            'oyun': provider_package_id,  # oyun_bilgi_id
            'referans': referans,
        }
        if payload.get('kupur') is not None:
            q['kupur'] = payload.get('kupur')
        if payload.get('userIdentifier'):
            q['musteri_tel'] = payload.get('userIdentifier')
        if payload.get('extraField'):
            q['oyuncu_bilgi'] = payload.get('extraField')
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
        return { 'externalOrderId': ext_id, 'status': status, 'note': note, 'balance': balance, 'cost': cost }

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
