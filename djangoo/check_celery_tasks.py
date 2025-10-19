import redis
import json
from datetime import datetime

# Connect to Redis
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

print("=" * 80)
print("🔍 Checking Celery Tasks in Redis")
print("=" * 80)

# Check scheduled tasks
print("\n📅 Scheduled Tasks (celery beat schedule):")
scheduled_keys = r.keys('celery-task-meta-*')
print(f"Found {len(scheduled_keys)} task results in Redis")

# Check active tasks
print("\n⚡ Active Tasks:")
active_keys = r.keys('celery-task-*')
for key in active_keys[:10]:  # Show first 10
    try:
        value = r.get(key)
        if value:
            print(f"  {key}: {value[:100]}...")
    except:
        pass

# Check pending tasks in queues
print("\n📥 Pending Tasks in Queues:")
queues = ['celery', 'default']
for queue in queues:
    length = r.llen(queue)
    print(f"  Queue '{queue}': {length} tasks")
    if length > 0:
        # Show first task
        task = r.lindex(queue, 0)
        if task:
            print(f"    First task: {task[:200]}...")

# Check if beat scheduler is running
print("\n🎵 Celery Beat Status:")
beat_key = 'celery-beat-schedule'
if r.exists(beat_key):
    print(f"  ✅ Beat schedule exists")
else:
    print(f"  ❌ Beat schedule NOT found - Celery Beat might not be running!")

# Check periodic task schedule
print("\n⏰ Checking Periodic Tasks Configuration:")
try:
    from celery_app import app
    
    if hasattr(app.conf, 'beat_schedule'):
        print(f"  Found {len(app.conf.beat_schedule)} periodic tasks configured:")
        for task_name, task_config in app.conf.beat_schedule.items():
            schedule = task_config.get('schedule', 'unknown')
            task = task_config.get('task', 'unknown')
            print(f"    - {task_name}")
            print(f"      Task: {task}")
            print(f"      Schedule: {schedule}")
    else:
        print("  ❌ No beat_schedule configured!")
except Exception as e:
    print(f"  ❌ Error loading celery_app: {e}")

print("\n" + "=" * 80)
