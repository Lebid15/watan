"""
Create 'public' schema if missing and grant privileges to the configured DB user.
Runs using Django's current DB connection (the app role), avoiding admin credentials.
"""
from django.conf import settings
from django.db import connection


def main() -> None:
    user = settings.DATABASES["default"]["USER"]
    stmts = [
        f"CREATE SCHEMA IF NOT EXISTS public AUTHORIZATION \"{user}\"",
        f"GRANT ALL ON SCHEMA public TO \"{user}\"",
    ]
    with connection.cursor() as cur:
        for sql in stmts:
            cur.execute(sql)
    print(f"Ensured 'public' schema and grants for user '{user}'.")


if __name__ == "__main__":
    main()
