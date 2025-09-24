import os
import sys
import psycopg

HOST = os.getenv("PGHOST", "localhost")
PORT = int(os.getenv("PGPORT", "5432"))
ADMIN_USER = os.getenv("PGADMINUSER", "postgres")
ADMIN_PASS = os.getenv("PGADMINPASS", "")
DB_NAME = os.getenv("POSTGRES_DB", "watan")
TARGET_USER = os.getenv("POSTGRES_USER", "watan")
TARGET_PASS = os.getenv("POSTGRES_PASSWORD", "Asdf1212asdf.")

print(f"Connecting to Postgres admin db as {ADMIN_USER}@{HOST}:{PORT} ...")

conn = None
try:
    conn = psycopg.connect(host=HOST, port=PORT, user=ADMIN_USER, password=ADMIN_PASS, dbname="postgres")
except Exception as e:
    print("First connect attempt failed (empty password). Trying 'postgres' password as fallback ...")
    try:
        conn = psycopg.connect(host=HOST, port=PORT, user=ADMIN_USER, password="postgres", dbname="postgres")
    except Exception as e2:
        print("Failed to connect as admin to Postgres:", e2)
        sys.exit(1)

with conn:
    with conn.cursor() as cur:
        cur.execute(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = %s) THEN
                EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', %s, %s);
              ELSE
                EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', %s, %s);
              END IF;
            END
            $$;
            """,
            (TARGET_USER, TARGET_USER, TARGET_PASS, TARGET_USER, TARGET_PASS),
        )
        print(f"Role ensured: {TARGET_USER}")

# Now grant privileges on target DB and schema
try:
    with psycopg.connect(host=HOST, port=PORT, user=ADMIN_USER, password=ADMIN_PASS, dbname=DB_NAME) as dbc:
        with dbc.cursor() as cur:
            stmts = [
                f'GRANT CONNECT ON DATABASE "{DB_NAME}" TO "{TARGET_USER}";',
                'GRANT USAGE ON SCHEMA public TO "{user}";'.format(user=TARGET_USER),
                'GRANT CREATE ON SCHEMA public TO "{user}";'.format(user=TARGET_USER),
                'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "{user}";'.format(user=TARGET_USER),
                'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "{user}";'.format(user=TARGET_USER),
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "{user}";'.format(user=TARGET_USER),
                'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "{user}";'.format(user=TARGET_USER),
            ]
            for s in stmts:
                cur.execute(s)
            print(f"Grants applied on DB {DB_NAME} and schema public for user {TARGET_USER}")
except Exception as e:
    print("Granting privileges encountered an error (continuing):", e)

print("Done.")
