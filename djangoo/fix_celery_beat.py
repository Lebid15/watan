"""
Fix duplicate Celery Beat tasks
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django_celery_beat.models import PeriodicTask, IntervalSchedule

print("\n" + "="*80)
print("FIXING CELERY BEAT - REMOVING DUPLICATE TASKS")
print("="*80)

# 1. Show current tasks
tasks = PeriodicTask.objects.all()
print(f"\n📊 Current tasks: {tasks.count()}")
for task in tasks:
    print(f"  - {task.name} (enabled: {task.enabled}, runs: {task.total_run_count})")

# 2. Delete ALL tasks (we'll recreate the correct one)
print(f"\n🗑️  Deleting all {tasks.count()} tasks...")
deleted_count = tasks.count()
tasks.delete()
print(f"✅ Deleted {deleted_count} tasks")

# 3. Create single correct task
print("\n📝 Creating single periodic task...")

# Get or create 5-minute interval
interval, _ = IntervalSchedule.objects.get_or_create(
    every=5,
    period=IntervalSchedule.MINUTES,
)

# Create the task
task = PeriodicTask.objects.create(
    name='check-pending-orders-every-5-minutes',
    task='apps.orders.tasks.check_pending_orders_batch',
    interval=interval,
    enabled=True,
)

print(f"✅ Created task: {task.name}")
print(f"   - Interval: every {interval.every} {interval.period}")
print(f"   - Task: {task.task}")
print(f"   - Enabled: {task.enabled}")

print("\n" + "="*80)
print("✅ DONE! Celery Beat fixed")
print("="*80)
print("\nNext steps:")
print("1. Stop Celery: .\\STOP_ALL_CELERY.ps1")
print("2. Clear Redis: cd redis-portable; .\\redis-cli.exe FLUSHALL")
print("3. Start Celery: .\\START_CELERY_WITH_BEAT.ps1")
print()
