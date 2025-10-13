"""
Celery configuration for djangoo project.

This module sets up Celery for handling background tasks and periodic tasks.
"""
import os
from celery import Celery

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Create Celery app
app = Celery('djangoo')

# Load configuration from Django settings with CELERY namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all installed apps
# By default, autodiscover looks for 'tasks.py' in each app
# We need to also discover 'tasks_dispatch.py'
app.autodiscover_tasks(lambda: ['apps.orders'], related_name='tasks')
app.autodiscover_tasks(lambda: ['apps.orders'], related_name='tasks_dispatch')


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to test Celery is working"""
    print(f'Request: {self.request!r}')
