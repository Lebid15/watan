"""
Direct Postgres admin fix script using psycopg.

Reads env vars:
  PGHOST, PGPORT, PGADMINUSER, PGADMINPASS  -> admin connection
  POSTGRES_DB                                -> target database name
  TARGET_ROLE                                -> role to grant and set search_path for (default: 'watan')

Idempotent: safe to run multiple times.
"""
from __future__ import annotations

import os
import sys
import psycopg


def env(name: str, default: str | None = None) -> str:
    val = os.environ.get(name, default)
    if val is None:
        print(f"Missing required env var: {name}", file=sys.stderr)
        sys.exit(2)
    return val


def main() -> None:
    host = env("PGHOST", "localhost")
    port = int(os.environ.get("PGPORT", "5432"))
    admin_user = env("PGADMINUSER", "postgres")
    admin_pass = os.environ.get("PGADMINPASS", "")
    target_db = env("POSTGRES_DB")
    target_role = os.environ.get("TARGET_ROLE", "watan")

    admin_dsn = f"host={host} port={port} dbname=postgres user={admin_user} password={admin_pass}"

    # 1) Set DB-level search_path and ensure public exists (connect to target DB for schema ops)
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(f"ALTER DATABASE \"{target_db}\" SET search_path=public, pg_catalog")
            # Set per-role per-DB search_path
            cur.execute(
                f"ALTER ROLE \"{target_role}\" IN DATABASE \"{target_db}\" SET search_path=public, pg_catalog"
            )

    # 2) Ensure public schema exists and grant privileges inside the target DB
    target_dsn = f"host={host} port={port} dbname={target_db} user={admin_user} password={admin_pass}"
    with psycopg.connect(target_dsn, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE SCHEMA IF NOT EXISTS public")
            cur.execute(f"GRANT USAGE ON SCHEMA public TO \"{target_role}\"")
            cur.execute(f"GRANT CREATE ON SCHEMA public TO \"{target_role}\"")

    print(
        f"Configured database '{target_db}' and role '{target_role}': search_path set and public schema grants applied."
    )


if __name__ == "__main__":
    main()
