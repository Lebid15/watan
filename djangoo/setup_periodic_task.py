#!/usr/bin/env python
"""
Script to create periodic task for checking pending orders.

This task will run every 5 minutes to check the status of pending orders.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django_celery_beat.models import PeriodicTask, IntervalSchedule


def create_periodic_task():
    """Create periodic task for checking pending orders"""
    
    # Create or get interval schedule (every 5 minutes)
    schedule, created = IntervalSchedule.objects.get_or_create(
        every=5,
        period=IntervalSchedule.MINUTES,
    )
    
    if created:
        print("✅ Created new interval schedule: Every 5 minutes")
    else:
        print("✅ Using existing interval schedule: Every 5 minutes")
    
    # Create or update the periodic task
    task, created = PeriodicTask.objects.update_or_create(
        name='Check pending orders batch',
        defaults={
            'task': 'apps.orders.tasks.check_pending_orders_batch',
            'interval': schedule,
            'enabled': True,
            'description': 'Checks the status of pending orders every 5 minutes',
        }
    )
    
    if created:
        print("✅ Created new periodic task: Check pending orders batch")
    else:
        print("✅ Updated existing periodic task: Check pending orders batch")
    
    print(f"\n📋 Periodic Task Details:")
    print(f"   - Name: {task.name}")
    print(f"   - Task: {task.task}")
    print(f"   - Schedule: Every {schedule.every} {schedule.period}")
    print(f"   - Enabled: {task.enabled}")
    print(f"   - Description: {task.description}")
    
    print(f"\n🎉 Periodic task setup complete!")
    print(f"   The task will run every 5 minutes to check pending orders.")
    print(f"   Make sure Celery Beat is running: celery -A djangoo beat")


if __name__ == "__main__":
    create_periodic_task()
