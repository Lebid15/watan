"""
Ensure Postgres DB has a proper search_path and the target role has privileges on the public schema.

Usage:
  # Use admin connection via env overrides and set TARGET_ROLE
  POSTGRES_USER=postgres POSTGRES_PASSWORD=... TARGET_ROLE=watan \
    python manage.py shell -c "import runpy; runpy.run_path('scripts/fix_db_config.py')"
"""

from django.conf import settings
from django.db import connection
import os


def main() -> None:
    db_name = settings.DATABASES["default"]["NAME"]
    target_role = os.environ.get("TARGET_ROLE", settings.DATABASES["default"]["USER"])

    stmts = [
        # Ensure schema exists
        "CREATE SCHEMA IF NOT EXISTS public",
        # Ensure default search_path on the database
        f"ALTER DATABASE \"{db_name}\" SET search_path=public, pg_catalog",
        # Ensure target role has search_path when connecting to this DB
        f"ALTER ROLE \"{target_role}\" IN DATABASE \"{db_name}\" SET search_path=public, pg_catalog",
        # Basic privileges on public schema for target role
        f"GRANT USAGE ON SCHEMA public TO \"{target_role}\"",
        f"GRANT CREATE ON SCHEMA public TO \"{target_role}\"",
    ]

    with connection.cursor() as cur:
        for sql in stmts:
            cur.execute(sql)

    print(f"Configured search_path and privileges for role '{target_role}' on database '{db_name}'.")


if __name__ == "__main__":
    main()
