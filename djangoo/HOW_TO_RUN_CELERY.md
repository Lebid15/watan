# =============================================
# كيفية تشغيل Celery بشكل صحيح
# =============================================

## المشكلة الحالية:
- الطلب EC989B في halil (manual mode)
- Celery Worker يعمل ✅
- Celery Beat **لا يعمل** ❌
- النتيجة: لا توجد periodic tasks لفحص حالة الطلبات!

## الحل - خياران:

### الخيار 1: تشغيل يدوي في نافذتين (أسهل للمراقبة):

#### خطوة 1: شغّل Beat في نافذة منفصلة:
```powershell
# افتح نافذة PowerShell جديدة
cd F:\watan
.\START_CELERY_BEAT_ONLY.ps1
```
ستشاهد:
```
LocalTime: Sending due task check-pending-orders-batch
```

#### خطوة 2: شغّل Worker في نافذة أخرى:
```powershell
# افتح نافذة PowerShell ثانية
cd F:\watan
.\START_CELERY_ONLY.ps1
```
ستشاهد:
```
Task apps.orders.tasks.check_pending_orders_batch received
Checking pending orders...
```

---

### الخيار 2: تشغيل أوتوماتيكي (Beat في الخلفية):

#### في نافذة PowerShell واحدة:
```powershell
cd F:\watan
.\START_CELERY_WITH_BEAT.ps1
```
- Beat يعمل في نافذة منفصلة (minimized)
- Worker يعمل في النافذة الحالية

---

## التحقق من أن كل شيء يعمل:

### 1. تحقق من Processes:
```powershell
Get-WmiObject Win32_Process -Filter "name = 'python.exe'" | Where-Object { $_.CommandLine -like "*celery*" } | Select-Object ProcessId, @{Name='Type';Expression={if($_.CommandLine -like '*beat*'){'Beat'}elseif($_.CommandLine -like '*worker*'){'Worker'}else{'Unknown'}}} | Format-Table -AutoSize
```

يجب أن ترى:
```
ProcessId Type
--------- ----
12345     Beat
67890     Worker
```

### 2. راقب logs Worker:
في نافذة Worker، يجب أن ترى كل 5 دقائق:
```
[INFO] Task apps.orders.tasks.check_pending_orders_batch received
[INFO] Checking 1 pending orders...
[INFO] Order EC989B: Checking status...
```

### 3. راقب logs Beat:
في نافذة Beat، يجب أن ترى كل 5 دقائق:
```
[INFO] Sending due task check-pending-orders-batch (apps.orders.tasks.check_pending_orders_batch)
```

---

## اختبار الطلب EC989B:

بعد تشغيل Beat + Worker:

1. انتظر 5 دقائق (أو أقل إذا قللت interval)
2. راقب logs Celery
3. يجب أن يفحص Celery حالة الطلب تلقائياً
4. إذا كان الطلب في "manual mode"، لن يُرسل تلقائياً
5. لكن ستشاهد السجلات (logs) تؤكد أن Beat يعمل

---

## تقليل وقت الانتظار (اختياري):

إذا أردت اختبار أسرع (كل 30 ثانية بدلاً من 5 دقائق):

```powershell
cd F:\watan\djangoo
python djangoo/update_beat_interval.py
```

السكريبت سينشئه لك تلقائياً.

---

## إيقاف كل شيء:

```powershell
cd F:\watan
.\STOP_ALL_CELERY.ps1
```
