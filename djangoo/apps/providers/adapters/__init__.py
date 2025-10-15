from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from .barakat import BarakatAdapter, BarakatCredentials
from .znet import ZnetAdapter, ZnetCredentials
from .internal import InternalAdapter, InternalCredentials


@dataclass(frozen=True)
class AdapterBinding:
    provider: str
    adapter: Any
    _builder: Callable[[Dict[str, Any]], Any]

    def credentials(self, values: Dict[str, Any]):
        return self._builder(values)


def _znet_builder(values: Dict[str, Any]) -> ZnetCredentials:
    return ZnetCredentials(
        base_url=values.get('base_url'),
        kod=values.get('kod'),
        sifre=values.get('sifre'),
    )


def _barakat_builder(values: Dict[str, Any]) -> BarakatCredentials:
    return BarakatCredentials(
        base_url=values.get('base_url'),
        api_token=values.get('api_token'),
    )


def _internal_builder(values: Dict[str, Any]) -> InternalCredentials:
    return InternalCredentials(
        base_url=values.get('base_url'),
        api_token=values.get('api_token'),
    )


def get_adapter(provider: str) -> Optional[AdapterBinding]:
    key = (provider or '').strip().lower()
    if key == 'znet':
        return AdapterBinding(provider='znet', adapter=ZnetAdapter(), _builder=_znet_builder)
    if key in ('barakat', 'apstore'):
        return AdapterBinding(provider=key, adapter=BarakatAdapter(), _builder=_barakat_builder)
    if key == 'internal':
        return AdapterBinding(provider='internal', adapter=InternalAdapter(), _builder=_internal_builder)
    return None


def _apply_overrides(values: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    mapping = {
        'provider': 'provider',
        'baseUrl': 'base_url',
        'base_url': 'base_url',
        'apiToken': 'api_token',
        'api_token': 'api_token',
        'kod': 'kod',
        'sifre': 'sifre',
    }
    updated = dict(values)
    for key, value in overrides.items():
        alias = mapping.get(key)
        if alias:
            updated[alias] = value
    return updated


def resolve_adapter_credentials(
    provider: str,
    *,
    base_url: Any = None,
    api_token: Any = None,
    kod: Any = None,
    sifre: Any = None,
    overrides: Optional[Dict[str, Any]] = None,
) -> tuple[Optional[AdapterBinding], Optional[Any]]:
    binding = get_adapter(provider)
    if not binding:
        return None, None
    values: Dict[str, Any] = {
        'provider': provider,
        'base_url': base_url,
        'api_token': api_token,
        'kod': kod,
        'sifre': sifre,
    }
    if overrides:
        values = _apply_overrides(values, overrides)
    try:
        creds = binding.credentials(values)
    except Exception:
        raise
    return binding, creds


__all__ = [
    'AdapterBinding',
    'get_adapter',
    'resolve_adapter_credentials',
    'ZnetAdapter',
    'ZnetCredentials',
    'BarakatAdapter',
    'BarakatCredentials',
    'InternalAdapter',
    'InternalCredentials',
]
