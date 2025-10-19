import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django_celery_beat.models import PeriodicTask, IntervalSchedule, CrontabSchedule

print("=" * 80)
print("🔍 Checking Celery Beat Periodic Tasks in Database")
print("=" * 80)

# Check periodic tasks
tasks = PeriodicTask.objects.all()
print(f"\n📋 Found {tasks.count()} periodic tasks:")

if tasks.exists():
    for task in tasks:
        status = "✅ Enabled" if task.enabled else "❌ Disabled"
        print(f"\n  {status}: {task.name}")
        print(f"    Task: {task.task}")
        print(f"    Last Run: {task.last_run_at}")
        print(f"    Total Runs: {task.total_run_count}")
        
        # Show schedule
        if task.interval:
            print(f"    Schedule: Every {task.interval}")
        elif task.crontab:
            print(f"    Schedule: Crontab {task.crontab}")
else:
    print("\n  ⚠️ No periodic tasks configured!")
    print("\n  You need to create periodic tasks for:")
    print("    - apps.orders.tasks.check_order_status")
    print("    - apps.orders.tasks.check_pending_orders_batch")

# Check schedules
intervals = IntervalSchedule.objects.all()
print(f"\n⏰ Found {intervals.count()} interval schedules:")
for schedule in intervals:
    print(f"  - Every {schedule.every} {schedule.period}")

crontabs = CrontabSchedule.objects.all()
print(f"\n📅 Found {crontabs.count()} crontab schedules:")
for schedule in crontabs:
    print(f"  - {schedule}")

print("\n" + "=" * 80)
