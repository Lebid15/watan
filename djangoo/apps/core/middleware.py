from __future__ import annotations

import time
import logging

logger = logging.getLogger("request")


class RequestLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.time()
        tenant = getattr(request, 'tenant', None)
        tenant_id = getattr(tenant, 'id', None)
        user = getattr(request, 'user', None)
        user_id = getattr(user, 'id', None)
        path = request.path
        method = request.method
        status_code = None
        try:
            response = self.get_response(request)
            status_code = response.status_code
            return response
        finally:
            duration = int((time.time() - start) * 1000)
            logger.info(
                "req", extra={
                    "method": method,
                    "path": path,
                    "tenantId": str(tenant_id) if tenant_id else None,
                    "userId": str(user_id) if user_id else None,
                    "status": status_code,
                    "durationMs": duration,
                }
            )
