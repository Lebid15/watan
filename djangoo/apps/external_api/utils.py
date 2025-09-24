from __future__ import annotations

import hashlib
import json
import time
from typing import Optional
from django.core.cache import cache


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def token_prefix(token: str, n: int = 8) -> str:
    return token[:n]


class SimpleRateLimiter:
    def __init__(self, key: str, limit: int, window_seconds: int):
        self.key = f"rate:{key}"
        self.limit = limit
        self.window = window_seconds

    def allow(self) -> bool:
        now = int(time.time())
        bucket = now // self.window
        k = f"{self.key}:{bucket}"
        val = cache.get(k)
        if val is None:
            cache.set(k, 1, timeout=self.window)
            return True
        if int(val) >= self.limit:
            return False
        cache.incr(k)
        return True


def idempotency_key(token_id: str, key: str, request_hash: str) -> str:
    return f"idem:{token_id}:{key}:{request_hash}"
