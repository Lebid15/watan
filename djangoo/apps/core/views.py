from django.http import JsonResponse, HttpRequest
from django.conf import settings
from django.db import connection
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
import os


def health(request):
    return JsonResponse({"status": "ok"})


def public_latest_note(request):
    """
    Minimal public developer note endpoint used by the AdminTopBar.
    Returns a simple payload { value: string, updatedAt: ISO or null }.

    Source hierarchy (first found wins):
    - settings.DEV_PUBLIC_NOTE and settings.DEV_PUBLIC_NOTE_UPDATED_AT
    - env DJ_PUBLIC_DEV_NOTE and DJ_PUBLIC_DEV_NOTE_UPDATED_AT
    - fallback: empty note with null updatedAt
    """
    # 1) Try DB-backed value first (per-tenant) if available
    note = None
    try:
        # resolve tenant id like other views (lightweight, duplicated to avoid import cycles)
        tid = request.META.get('HTTP_X_TENANT_ID')
        if not tid:
            host_header = request.META.get(getattr(settings, 'TENANT_HEADER', 'HTTP_X_TENANT_HOST')) or request.META.get('HTTP_HOST')
            if host_header:
                host = host_header.split(':')[0]
                try:
                    from apps.tenants.models import TenantDomain  # type: ignore
                    dom = TenantDomain.objects.filter(domain=host).order_by('-is_primary').first()
                    if dom and getattr(dom, 'tenant_id', None):
                        tid = str(dom.tenant_id)
                except Exception:
                    pass
        if tid:
            with connection.cursor() as c:
                c.execute('SELECT content FROM site_page WHERE "tenantId"=%s AND "key"=%s LIMIT 1', [tid, 'dev_public_note'])
                row = c.fetchone()
                if row and row[0]:
                    note = row[0]
    except Exception:
        pass

    # 2) Fall back to settings/env
    if note is None:
        note = getattr(settings, 'DEV_PUBLIC_NOTE', None) or settings.environ.get('DJ_PUBLIC_DEV_NOTE') if hasattr(settings, 'environ') else None
    if note is None:
        import os
        note = os.getenv('DJ_PUBLIC_DEV_NOTE')
    updated = getattr(settings, 'DEV_PUBLIC_NOTE_UPDATED_AT', None)
    if not updated:
        # allow ISO string via env var
        if hasattr(settings, 'environ'):
            updated = settings.environ.get('DJ_PUBLIC_DEV_NOTE_UPDATED_AT')
        if not updated:
            import os
            updated = os.getenv('DJ_PUBLIC_DEV_NOTE_UPDATED_AT')
    # Normalize updatedAt to ISO string if it's a datetime
    if hasattr(updated, 'isoformat'):
        updated_iso = updated.isoformat()
    else:
        updated_iso = updated if isinstance(updated, str) else None
    return JsonResponse({ 'value': note or '', 'updatedAt': updated_iso })


# ===== Maintenance state (developer tools parity) =====
# An in-memory toggle that also mirrors a cookie MAINT_ON across the apex domain
_MAINT = {
    'enabled': False,
    'message': 'يرجى الانتظار لدينا صيانة على الموقع وسنعود فور الانتهاء.',
    'updatedAt': None,
}

def _apex_domain():
    return getattr(settings, 'APEX_DOMAIN', None) or os.environ.get('NEXT_PUBLIC_APEX_DOMAIN') or 'wtn4.com'

def _get_latest_site_page(key: str) -> tuple[str, str | None]:
    try:
        with connection.cursor() as c:
            c.execute('SELECT content, "updatedAt" FROM site_page WHERE "key"=%s ORDER BY "updatedAt" DESC NULLS LAST LIMIT 1', [key])
            row = c.fetchone()
            if not row:
                return '', None
            content = row[0] or ''
            updated = row[1].isoformat() if row[1] else None
            return content, updated
    except Exception:
        return '', None

def dev_maintenance_get(request: HttpRequest):
    # Always reflect latest persisted state so Admin changes are visible immediately
    on_val, on_updated = _get_latest_site_page('maintenance_on')
    msg_val, msg_updated = _get_latest_site_page('maintenance_message')
    enabled = on_val == '1'
    message = msg_val or _MAINT['message']
    updated = on_updated or msg_updated or timezone.now().isoformat()
    _MAINT.update({'enabled': enabled, 'message': message, 'updatedAt': updated})
    resp = JsonResponse({'enabled': _MAINT['enabled'], 'message': _MAINT['message'], 'updatedAt': _MAINT['updatedAt']})
    domain = _apex_domain()
    if _MAINT['enabled']:
        resp.set_cookie('MAINT_ON', '1', path='/', samesite='Lax', domain=f'.{domain}')
    else:
        try:
            resp.delete_cookie('MAINT_ON', path='/', domain=f'.{domain}')
        except Exception:
            pass
    return resp

@csrf_exempt
def dev_maintenance_post(request: HttpRequest):
    # Very permissive (for parity in dev). In production, secure with auth/role.
    try:
        data = request.POST or {}
        if not data:
            # JSON body
            import json
            data = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        data = {}
    raw = data.get('enabled', False)
    if isinstance(raw, str):
        enabled = raw.lower() in ('1','true','on','yes')
    else:
        enabled = bool(raw)
    msg = data.get('message')
    if isinstance(msg, str):
        msg = msg.strip()[:5000]
        if msg:
            _MAINT['message'] = msg
    _MAINT['enabled'] = enabled
    _MAINT['updatedAt'] = timezone.now().isoformat()
    return dev_maintenance_get(request)
