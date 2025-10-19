import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django_celery_beat.models import IntervalSchedule, PeriodicTask

print("=" * 80)
print("[UPDATE] Update Beat Interval to 10 seconds")
print("=" * 80)

# Create 10 seconds interval
interval_10s, created = IntervalSchedule.objects.get_or_create(
    every=10,
    period=IntervalSchedule.SECONDS,
)

if created:
    print("\n[SUCCESS] Created interval: every 10 seconds")
else:
    print("\n[SUCCESS] Found existing interval: every 10 seconds")

# Update task
task = PeriodicTask.objects.get(name='Check pending orders batch')
old_interval = task.interval
task.interval = interval_10s
task.save()

print(f"\n[SUCCESS] Updated task: {task.name}")
print(f"   Old: {old_interval}")
print(f"   New: {interval_10s}")
print(f"\n[WARNING] Restart Celery Beat for changes to take effect!")
print(f"   (Or wait for next beat cycle)")
print("\n" + "=" * 80)
