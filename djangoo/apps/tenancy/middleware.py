from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from .models import Tenant
try:
    # Unmanaged tenant_domain mapping from primary system
    from apps.tenants.models import TenantDomain  # type: ignore
except Exception:  # pragma: no cover
    TenantDomain = None


class TenantHostMiddleware(MiddlewareMixin):
    def process_request(self, request):
        host_header = request.META.get(settings.TENANT_HEADER) or request.META.get('HTTP_HOST')
        tenant_obj = None
        if host_header:
            # Strip port if included
            host = host_header.split(':')[0]
            # Prefer resolving to real tenant UUID via tenant_domain
            if TenantDomain is not None:
                try:
                    dom = TenantDomain.objects.filter(domain=host).order_by('-is_primary').first()
                    if dom and getattr(dom, 'tenant_id', None):
                        class _T:  # lightweight carrier with id attr (UUID)
                            pass
                        t = _T()
                        t.id = dom.tenant_id
                        tenant_obj = t
                except Exception:
                    tenant_obj = None
            # Fallback to local dev dj_tenants table (id is integer, useful for debugging only)
            if tenant_obj is None:
                try:
                    tenant_obj = Tenant.objects.filter(host=host, is_active=True).first()
                except Exception:
                    tenant_obj = None
        request.tenant = tenant_obj
        return None
