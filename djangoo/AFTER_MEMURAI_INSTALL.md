# خطوات ما بعد تثبيت Memurai

## الخطوة 1: التحقق من أن Memurai شغال

افتح PowerShell واكتب:
```powershell
Get-Service Memurai
```

**يجب أن تشوف**:
```
Status   Name               DisplayName
------   ----               -----------
Running  Memurai            Memurai
```

---

## الخطوة 2: اختبار الاتصال

في نفس PowerShell، اكتب:
```powershell
cd f:\watan\djangoo
.\venv\Scripts\python.exe -c "import redis; r = redis.Redis(host='localhost', port=6379, db=0); print('✅ Redis متصل:', r.ping())"
```

**يجب أن تشوف**:
```
✅ Redis متصل: True
```

---

## الخطوة 3: تشغيل Celery Worker

في نفس PowerShell، اكتب:
```powershell
.\venv\Scripts\python.exe -m celery -A celery_app worker -l info --pool=solo
```

**سترى شيء مثل**:
```
-------------- celery@DESKTOP-XXX v5.4.0 (opalescent)
--- ***** ----- 
-- ******* ---- Windows-11-10.0.26100-SP0 2025-10-10 21:XX:XX
- *** --- * --- 
- ** ---------- [config]
- ** ---------- .> app:         djangoo:0xXXXXXXXXX
- ** ---------- .> transport:   redis://localhost:6379/0
- ** ---------- .> results:     django-db
...
[tasks]
  . apps.orders.tasks.check_order_status
  . apps.orders.tasks.check_pending_orders_batch

[2025-10-10 21:XX:XX] INFO/MainProcess] Connected to redis://localhost:6379/0
[2025-10-10 21:XX:XX] INFO/MainProcess] ready.
```

---

## ✨ الآن النظام شغال!

عندما يتم إنشاء طلب جديد، سترى في الترمينال:
```
================================================================================
🔍 DEBUG: Processing provider response for order 12345
================================================================================
📥 Full Response from provider: {'status': 'cancelled', 'message': '...'}
...
✅ Will update order status: pending → rejected
💾 Database Update: UPDATE product_orders...
================================================================================
```

---

## ⚠️ ملاحظة مهمة

**خلّي terminal الـ Celery مفتوح** طول ما تشتغل!
- إذا سكرته، المراقبة التلقائية راح توقف
- Django server (المنفذ 8000) خلّيه شغال في terminal ثاني
- Celery worker شغّله في terminal ثالث

---

## 🔄 في المستقبل

كل ما تفتح جهازك وتبي تشغل المشروع:

1. **Terminal 1** - Django:
   ```powershell
   cd f:\watan\djangoo
   .\venv\Scripts\python.exe manage.py runserver
   ```

2. **Terminal 2** - Celery:
   ```powershell
   cd f:\watan\djangoo
   .\venv\Scripts\python.exe -m celery -A celery_app worker -l info --pool=solo
   ```

**Memurai سيشتغل تلقائياً** - ما تحتاج تشغله يدوياً! ✅
