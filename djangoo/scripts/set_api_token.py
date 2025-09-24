from django.core.wsgi import get_wsgi_application
import os, secrets, sys
from pathlib import Path

# Ensure project root is on sys.path so 'config' package resolves
BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
get_wsgi_application()

from django.contrib.auth import get_user_model
from apps.tenancy.models import Tenant

User = get_user_model()
u = User.objects.filter(is_superuser=True).first()
if not u:
    print('No superuser found')
else:
    token = secrets.token_hex(24)
    u.api_token = token
    u.save(update_fields=['api_token'])
    print('API_TOKEN=' + token)

Tenant.objects.get_or_create(host='localhost', defaults={'name': 'localhost', 'is_active': True})
print('Tenant ensured')
