from __future__ import annotations

from .znet import ZnetAdapter, ZnetCredentials


def get_adapter(provider: str):
    key = (provider or '').strip().lower()
    if key == 'znet':
        return ZnetAdapter()
    # Future: add other adapters (barakat, apstore, ...)
    return None


__all__ = ['get_adapter', 'ZnetAdapter', 'ZnetCredentials']
