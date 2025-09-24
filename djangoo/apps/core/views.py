from django.http import JsonResponse
from django.conf import settings
from django.db import connection


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
