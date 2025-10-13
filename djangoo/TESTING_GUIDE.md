# 🧪 دليل الاختبار السريع

## الخطوة 1: تطبيق Migration يدوياً

### افتح psql أو أي SQL client واتصل بقاعدة البيانات:
```bash
psql -U watan -d watan
```

### شغّل هذا SQL:
```sql
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS provider_referans VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_orders_provider_referans ON product_orders(provider_referans);
```

### تحقق من النجاح:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'product_orders' 
AND column_name = 'provider_referans';
```

يجب أن ترى:
```
column_name        | data_type       
-------------------+-----------------
provider_referans  | character varying
```

---

## الخطوة 2: تشغيل Redis

### Windows:
```bash
# إذا كان Redis مثبت
redis-server

# أو استخدم Docker
docker run -d -p 6379:6379 redis:alpine
```

### تحقق من Redis:
```bash
redis-cli ping
# يجب أن يرد: PONG
```

---

## الخطوة 3: تشغيل النظام

### Terminal 1 - Django:
```bash
cd f:\watan\djangoo
python manage.py runserver
```

### Terminal 2 - Celery Worker:
```bash
cd f:\watan\djangoo
celery -A djangoo worker --loglevel=info --pool=solo
```

يجب أن ترى:
```
-------------- celery@YOURHOSTNAME v5.4.0
--- ***** -----
-- ******* ---- Windows-10-10.0.xxxxx
...
[tasks]
  . apps.orders.tasks.check_order_status
  . apps.orders.tasks.check_pending_orders_batch
  . djangoo.celery_app.debug_task

[2025-xx-xx xx:xx:xx,xxx: INFO/MainProcess] Connected to redis://localhost:6379/0
```

### Terminal 3 - Celery Beat:
```bash
cd f:\watan\djangoo
celery -A djangoo beat --loglevel=info
```

يجب أن ترى:
```
celery beat v5.4.0 is starting.
...
Scheduler: django_celery_beat.schedulers:DatabaseScheduler
...
beat: Starting...
```

---

## الخطوة 4: إنشاء طلب تجريبي

### عبر API:
```bash
# احصل على token أولاً
POST http://localhost:8000/api-dj/auth/login/
{
  "username": "your_username",
  "password": "your_password"
}

# ثم أنشئ طلب
POST http://localhost:8000/api-dj/orders/
Authorization: Bearer YOUR_TOKEN
{
  "productId": "xxx-xxx-xxx",
  "packageId": "xxx-xxx-xxx",
  "userIdentifier": "123456",
  "extraField": "654321",
  "quantity": 1
}
```

### أو عبر Django Admin:
1. افتح http://localhost:8000/admin/
2. اذهب إلى Orders
3. أنشئ طلب جديد

---

## الخطوة 5: مراقبة Logs

### في Terminal 1 (Django):
يجب أن ترى:
```
================================================================================
🚀 AUTO-DISPATCH START: Order ID = xxx-xxx-xxx
================================================================================

📦 Step 1: Fetching order...
   ✅ Order found: xxx-xxx-xxx
...
📝 Step 12: Processing provider response...
   ✅ Provider responded!
   - Provider Referans: xxx-xxx-xxx
...
⏰ Step 15: Scheduling status check...
   ✅ Status check scheduled!
   - Task ID: xxx-xxx-xxx
   - Will start in: 60 seconds
================================================================================
✅ AUTO-DISPATCH SUCCESS!
================================================================================
```

### في Terminal 2 (Celery Worker):
بعد دقيقة واحدة، يجب أن ترى:
```
[2025-xx-xx xx:xx:xx,xxx: INFO/MainProcess] Task apps.orders.tasks.check_order_status[xxx] received
[2025-xx-xx xx:xx:xx,xxx: INFO/ForkPoolWorker-1] 🔍 [Attempt 1] Checking status for order: xxx
[2025-xx-xx xx:xx:xx,xxx: INFO/ForkPoolWorker-1] 📡 Fetching status from znet for referans: xxx
[2025-xx-xx xx:xx:xx,xxx: INFO/ForkPoolWorker-1] 📥 Provider response: {'status': 'completed', 'pinCode': 'xxxxx'}
[2025-xx-xx xx:xx:xx,xxx: INFO/ForkPoolWorker-1] 🔄 Status changed: sent → completed
[2025-xx-xx xx:xx:xx,xxx: INFO/ForkPoolWorker-1] 🔑 PIN Code received: xxxxx
[2025-xx-xx xx:xx:xx,xxx: INFO/ForkPoolWorker-1] 💾 Order xxx updated
[2025-xx-xx xx:xx:xx,xxx: INFO/MainProcess] Task apps.orders.tasks.check_order_status[xxx] succeeded
```

### إذا لم يكتمل الطلب بعد:
```
[2025-xx-xx xx:xx:xx,xxx: INFO/ForkPoolWorker-1] ⏳ Order xxx still pending, will retry...
[2025-xx-xx xx:xx:xx,xxx: INFO/MainProcess] Task apps.orders.tasks.check_order_status[xxx] retry: Retry in 30s
```

---

## الخطوة 6: التحقق من النتيجة

### في قاعدة البيانات:
```sql
SELECT 
    id,
    "externalStatus",
    provider_referans,
    "pinCode",
    "sentAt",
    "lastSyncAt",
    "lastMessage"
FROM product_orders
ORDER BY "createdAt" DESC
LIMIT 5;
```

يجب أن ترى:
```
id          | externalStatus | provider_referans | pinCode  | sentAt              | lastSyncAt
------------+----------------+-------------------+----------+---------------------+-------------
xxx-xxx-xxx | completed      | xxx-xxx-xxx       | xxxxx    | 2025-xx-xx xx:xx:xx | 2025-xx-xx xx:xx:xx
```

---

## ✅ علامات النجاح

- [x] Django يعمل بدون أخطاء
- [x] Celery Worker متصل بـ Redis
- [x] Celery Beat يعمل ويجدول المهام
- [x] عند إنشاء طلب، ترى 15 خطوة في logs
- [x] Task يُجدول بعد دقيقة واحدة
- [x] Task يفحص الحالة من المزود
- [x] الحالة تتحدث في قاعدة البيانات
- [x] PIN Code يُحفظ عند الاكتمال

---

## ❌ استكشاف الأخطاء الشائعة

### Error: "cannot import name 'Celery' from 'celery'"
**السبب:** ملف celery.py يتعارض مع مكتبة celery  
**الحل:** تم حله! استخدمنا `celery_app.py` بدلاً من `celery.py`

### Error: "Connection refused" من Celery
**السبب:** Redis لا يعمل  
**الحل:**
```bash
redis-server
# أو
docker run -d -p 6379:6379 redis:alpine
```

### Error: "must be owner of table product_orders"
**السبب:** المستخدم الحالي لا يملك صلاحيات  
**الحل:** شغّل SQL migration كـ superuser:
```bash
psql -U postgres -d watan -c "ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS provider_referans VARCHAR(255);"
```

### Task لا يُنفذ
**السبب:** Celery Beat لا يعمل  
**الحل:**
```bash
celery -A djangoo beat --loglevel=info
```

### provider_referans NULL
**السبب:** Migration لم يُطبق  
**الحل:**
```bash
python add_provider_referans.py
# أو شغّل SQL يدوياً
```

---

## 🎯 الخطوة التالية

بعد التأكد من أن كل شيء يعمل:

1. **في Production:** استخدم Supervisor أو systemd لتشغيل Celery
2. **Monitoring:** ثبت Flower للمراقبة المتقدمة
3. **Scaling:** شغّل عدة Workers إذا زاد الحمل
4. **Logging:** استخدم logging service خارجي (مثل Sentry)

---

## 🚀 جاهز للإنتاج!

عند نجاح كل الخطوات أعلاه، النظام جاهز للاستخدام في Production! 🎉
