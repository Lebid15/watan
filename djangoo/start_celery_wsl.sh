#!/bin/bash
# Start Celery worker in WSL

cd /mnt/f/watan/djangoo

# Activate venv if exists in WSL, otherwise use system python
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start Celery worker
python -m celery -A celery_app worker -l info --pool=solo
