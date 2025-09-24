import os
from django.core.management.base import BaseCommand

class Command(BaseCommand):
  help = "Ensure local Postgres role POSTGRES_USER with POSTGRES_PASSWORD on POSTGRES_DB (connect as admin)."

  def handle(self, *args, **options):
    try:
      import psycopg
    except Exception as e:
      self.stderr.write("psycopg not installed: %s" % e)
      return

    host = os.getenv("POSTGRES_HOST", "localhost")
    port = int(os.getenv("POSTGRES_PORT", "5432"))
    dbname = os.getenv("POSTGRES_DB", "watan")
    target_user = os.getenv("POSTGRES_USER", "watan")
    target_pass = os.getenv("POSTGRES_PASSWORD", "changeme")

    admin_user = os.getenv("PGADMINUSER", "postgres")
    admin_pass = os.getenv("PGADMINPASS", "")

    self.stdout.write(self.style.NOTICE(
      f"Connecting to admin as {admin_user}@{host}:{port} to ensure role '{target_user}' for DB '{dbname}'"
    ))

    conn = None
    try:
      conn = psycopg.connect(host=host, port=port, user=admin_user, password=admin_pass, dbname="postgres")
    except Exception:
      # Fallback to common local default
      try:
        conn = psycopg.connect(host=host, port=port, user=admin_user, password="postgres", dbname="postgres")
      except Exception as e2:
        self.stderr.write("Admin connect failed: %s" % e2)
        return

    do_block = (
      "DO $$\n"
      "BEGIN\n"
      "  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = %s) THEN\n"
      "    EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', %s, %s);\n"
      "  ELSE\n"
      "    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', %s, %s);\n"
      "  END IF;\n"
      "END\n"
      "$$;"
    )

    with conn:
      with conn.cursor() as cur:
        cur.execute(do_block, (target_user, target_user, target_pass, target_user, target_pass))
    self.stdout.write(self.style.SUCCESS("Role created/updated."))

    # Apply grants on target DB
    try:
      with psycopg.connect(host=host, port=port, user=admin_user, password=admin_pass, dbname=dbname) as dbc:
        with dbc.cursor() as cur:
          stmts = [
            f'GRANT CONNECT ON DATABASE "{dbname}" TO "{target_user}";',
            f'GRANT USAGE ON SCHEMA public TO "{target_user}";',
            f'GRANT CREATE ON SCHEMA public TO "{target_user}";',
            f'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "{target_user}";',
            f'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "{target_user}";',
            f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "{target_user}";',
            f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "{target_user}";',
          ]
          for s in stmts:
            cur.execute(s)
      self.stdout.write(self.style.SUCCESS("Grants applied."))
    except Exception as e:
      self.stderr.write("Granting privileges encountered an error: %s" % e)

    self.stdout.write(self.style.SUCCESS("Done."))
