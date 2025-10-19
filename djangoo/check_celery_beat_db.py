import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="watan",
    user="watan",
    password="changeme"
)

cursor = conn.cursor()

print("=" * 80)
print("🔍 Checking Celery Beat Periodic Tasks in Database")
print("=" * 80)

# Check if django_celery_beat tables exist
cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'django_celery_beat%'
    ORDER BY table_name
""")

tables = cursor.fetchall()
if tables:
    print("\n✅ Django Celery Beat tables found:")
    for table in tables:
        print(f"  - {table[0]}")
else:
    print("\n❌ No django_celery_beat tables found!")
    print("   You may need to run: python manage.py migrate django_celery_beat")

# Check periodic tasks
cursor.execute("""
    SELECT 
        id, name, task, enabled, 
        last_run_at,
        total_run_count
    FROM django_celery_beat_periodictask
    ORDER BY name
""")

tasks = cursor.fetchall()
print(f"\n📋 Found {len(tasks)} periodic tasks:")
if tasks:
    for task in tasks:
        status = "✅ Enabled" if task[3] else "❌ Disabled"
        print(f"\n  {status}: {task[1]}")
        print(f"    Task: {task[2]}")
        print(f"    Last Run: {task[4]}")
        print(f"    Total Runs: {task[5]}")
else:
    print("  ⚠️ No periodic tasks configured!")
    print("  You need to create periodic tasks for:")
    print("    - check_order_status")
    print("    - check_pending_orders_batch")

# Check schedules
cursor.execute("""
    SELECT 
        id, name, schedule
    FROM django_celery_beat_intervalschedule
    ORDER BY name
""")

schedules = cursor.fetchall()
print(f"\n⏰ Found {len(schedules)} interval schedules:")
for schedule in schedules:
    print(f"  - {schedule[1]}: {schedule[2]}")

cursor.close()
conn.close()

print("\n" + "=" * 80)
