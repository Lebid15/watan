import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django_celery_beat.models import IntervalSchedule, PeriodicTask

print("=" * 80)
print("🔧 Update Beat Interval to 30 seconds (for faster testing)")
print("=" * 80)

# Create 30 seconds interval
interval_30s, created = IntervalSchedule.objects.get_or_create(
    every=30,
    period=IntervalSchedule.SECONDS,
)

if created:
    print("\n✅ Created interval: every 30 seconds")
else:
    print("\n✅ Found existing interval: every 30 seconds")

# Update task
task = PeriodicTask.objects.get(name='Check pending orders batch')
old_interval = task.interval
task.interval = interval_30s
task.save()

print(f"\n✅ Updated task: {task.name}")
print(f"   Old: {old_interval}")
print(f"   New: {interval_30s}")
print(f"\n⚠️ Restart Celery Beat for changes to take effect!")
print("\n" + "=" * 80)
