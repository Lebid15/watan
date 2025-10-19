# =============================================
# ملخص مشكلة Celery Worker و Beat
# =============================================

## المشكلة:
- Celery Worker يعمل ✅
- Celery Beat **لا يعمل** ❌
- النتيجة: لا توجد periodic tasks تعمل لفحص حالة الطلبات

## التشخيص:
```powershell
# الأمر الذي تشغله حالياً (خطأ):
celery -A celery_app worker --pool=solo --loglevel=info  # فقط worker!

# النتيجة:
- Worker يستمع للـ tasks الجديدة فقط
- لا يشغّل periodic tasks
- check_pending_orders_batch لم يُشغل أبداً (Last Run: None, Total Runs: 0)
```

## الحل:

### 1️⃣ توقف عن Celery Worker الحالي:
- اضغط Ctrl+C في نافذة Celery

### 2️⃣ شغّل Celery Worker + Beat معاً:
```powershell
# استخدم السكريبت الجديد:
.\START_CELERY_WITH_BEAT.ps1

# أو يدوياً:
celery -A celery_app worker --beat --pool=solo --loglevel=info
```

### 3️⃣ ستشاهد في الـ logs:
```
[INFO] beat: Starting...
[INFO] Scheduler: Sending due task check-pending-orders-batch
[INFO] Task apps.orders.tasks.check_pending_orders_batch received
[INFO] Checking pending orders...
```

## Periodic Tasks المكونة:

### ✅ check_pending_orders_batch
- **الجدولة**: كل 5 دقائق
- **الحالة**: مفعّل ✅
- **الوظيفة**: يفحص جميع الطلبات المعلقة (pending/processing)
- **يستخدم**: للطلبات التي تحتاج متابعة دورية

### ❌ check_order_status (معطّل)
- **الجدولة**: كل 10 ثواني
- **الحالة**: معطّل ❌
- **الوظيفة**: يفحص طلب محدد (يحتاج order_id)
- **ملاحظة**: هذا task يُستدعى يدوياً لطلبات محددة، ليس periodic

## ما بعد التشغيل:

### اختبار:
1. شغّل START_CELERY_WITH_BEAT.ps1
2. أرسل طلب من خليل إلى الشام
3. انتظر 5 دقائق (أو أقل إذا عدلت الجدولة)
4. ستشاهد Celery يفحص حالة الطلب تلقائياً!

### Logs المتوقعة:
```
[INFO] Task apps.orders.tasks.check_pending_orders_batch[uuid] received
[INFO] Checking 5 pending orders...
[INFO] Order ABC123: Checking status with provider...
[INFO] Order ABC123: Status updated to 'completed'
```

## ملاحظات مهمة:

### ⚠️ على Windows:
**لا يمكن** تشغيل Worker + Beat في process واحد!
```bash
# هذا لا يعمل على Windows:
celery -A celery_app worker --beat --pool=solo --loglevel=info
# Error: -B option does not work on Windows
```

### ✅ الطريقة الصحيحة على Windows:

#### الخيار 1: استخدام السكريبت الأوتوماتيكي (موصى به):
```powershell
.\START_CELERY_WITH_BEAT.ps1
```
- يشغّل Beat في نافذة منفصلة (minimized)
- يشغّل Worker في النافذة الحالية
- عند إغلاق Worker، يوقف Beat تلقائياً

#### الخيار 2: تشغيل يدوي منفصل:
```powershell
# Terminal 1 - Beat:
.\START_CELERY_BEAT_ONLY.ps1

# Terminal 2 - Worker:
.\START_CELERY_ONLY.ps1
```

#### الخيار 3: أوامر يدوية:
```powershell
# Terminal 1:
cd F:\watan\djangoo
$env:PYTHONPATH = "F:\watan\djangoo"
python -m celery -A celery_app beat --loglevel=info

# Terminal 2:
cd F:\watan\djangoo
$env:PYTHONPATH = "F:\watan\djangoo"
python -m celery -A celery_app worker --pool=solo --loglevel=info
```

3. **تعديل الجدولة**:
   - يمكن تعديل interval من Django Admin
   - أو من Database مباشرة
   - أو عبر Django shell:
   ```python
   from django_celery_beat.models import IntervalSchedule, PeriodicTask
   
   # تغيير إلى كل 30 ثانية بدلاً من 5 دقائق:
   schedule = IntervalSchedule.objects.create(every=30, period='seconds')
   task = PeriodicTask.objects.get(name='Check pending orders batch')
   task.interval = schedule
   task.save()
   ```

## الملفات ذات الصلة:
- `START_CELERY_ONLY.ps1` - يشغل Worker فقط
- `START_CELERY_BEAT_ONLY.ps1` - يشغل Beat فقط (جديد!)
- `START_CELERY_WITH_BEAT.ps1` - يشغل Worker + Beat معاً (أوتوماتيكي - موصى به!)
- `apps/orders/tasks.py` - tasks definitions
- `celery_app.py` - Celery configuration
- `config/settings.py` - CELERY_BEAT_SCHEDULER configuration

## الخلاصة:
على Windows، يجب تشغيل Celery Beat و Worker في processes منفصلة!
أسهل طريقة: استخدم `START_CELERY_WITH_BEAT.ps1` الذي يشغلهما تلقائياً.
