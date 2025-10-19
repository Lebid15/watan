import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django_celery_beat.models import PeriodicTask, IntervalSchedule
import json

print("=" * 80)
print("🔧 Creating Missing Periodic Task: check_order_status")
print("=" * 80)

# Create or get interval schedule (every 10 seconds)
schedule_10s, created = IntervalSchedule.objects.get_or_create(
    every=10,
    period=IntervalSchedule.SECONDS,
)
if created:
    print("\n✅ Created interval schedule: every 10 seconds")
else:
    print("\n✅ Found existing interval schedule: every 10 seconds")

# Check if task already exists
existing = PeriodicTask.objects.filter(name="Check order status").first()
if existing:
    print(f"\n⚠️ Task 'Check order status' already exists!")
    print(f"   Enabled: {existing.enabled}")
    print(f"   Task: {existing.task}")
else:
    # Create periodic task
    task = PeriodicTask.objects.create(
        interval=schedule_10s,
        name='Check order status',
        task='apps.orders.tasks.check_order_status',
        enabled=False,  # Disabled by default - enable manually if needed
    )
    print(f"\n✅ Created periodic task: Check order status")
    print(f"   Task: {task.task}")
    print(f"   Schedule: Every 10 seconds")
    print(f"   Status: DISABLED (enable manually if needed)")
    print(f"\n   ⚠️ NOTE: This task requires order_id and tenant_id arguments!")
    print(f"   It's meant to be called for specific orders, not as a periodic task.")
    print(f"   Consider using check_pending_orders_batch instead.")

# Show all periodic tasks
print("\n" + "=" * 80)
print("📋 All Periodic Tasks:")
print("=" * 80)
for task in PeriodicTask.objects.all():
    status = "✅ Enabled" if task.enabled else "❌ Disabled"
    print(f"\n  {status}: {task.name}")
    print(f"    Task: {task.task}")
    if task.interval:
        print(f"    Schedule: Every {task.interval}")
    print(f"    Last Run: {task.last_run_at}")
    print(f"    Total Runs: {task.total_run_count}")

print("\n" + "=" * 80)
