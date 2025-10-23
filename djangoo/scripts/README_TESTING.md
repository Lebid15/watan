# Admin Orders Smoke Test

Use `test_admin_orders_api.py` to confirm the admin orders endpoint responds once you provide valid credentials.

```powershell
$env:DJANGO_ADMIN_USER = "admin"
$env:DJANGO_ADMIN_PASSWORD = "admin"
python scripts/test_admin_orders_api.py
```

Override tenant headers when needed:

```powershell
python scripts/test_admin_orders_api.py --tenant-host alsham.localhost --tenant-id 11111111-2222-3333-4444-555555555555
```

Pass `--quiet` to suppress JSON dumps and only show status/counts.
