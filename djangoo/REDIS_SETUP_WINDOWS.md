# تثبيت Redis على Windows

## المشكلة
```
Error 10061 connecting to localhost:6379. No connection could be made because the target machine actively refused it.
```

Celery يحتاج Redis للعمل، لكن Redis غير مثبت على Windows.

## الحلول المتاحة

### الخيار 1: تثبيت Redis عبر WSL (الأفضل والأسرع) ✅

```powershell
# 1. تثبيت WSL إذا لم يكن مثبت
wsl --install

# 2. فتح WSL terminal
wsl

# 3. تثبيت Redis
sudo apt update
sudo apt install redis-server

# 4. تشغيل Redis
sudo service redis-server start

# 5. التحقق من Redis
redis-cli ping
# يجب أن يرجع: PONG
```

### الخيار 2: Memurai (نسخة Redis رسمية لـ Windows)

1. تحميل من: https://www.memurai.com/get-memurai
2. تثبيت البرنامج
3. سيشتغل تلقائياً كـ Windows Service على port 6379

### الخيار 3: Docker (إذا كان مثبت)

```powershell
docker run -d -p 6379:6379 redis:alpine
```

## التحقق من عمل Redis

```powershell
# بعد تثبيت Redis، جرّب:
cd f:\watan\djangoo
.\venv\Scripts\Activate.ps1
python -c "import redis; r = redis.Redis(host='localhost', port=6379, db=0); print(r.ping())"
# يجب أن يطبع: True
```

## تشغيل Celery بعد تثبيت Redis

```powershell
cd f:\watan\djangoo
& .\venv\Scripts\python.exe -m celery -A celery_app worker -l info --pool=solo
```

## حالة النظام حالياً

✅ **تم إكمالها**:
- Celery مثبت في البيئة الافتراضية
- Tasks معرّفة بشكل صحيح
- Django configuration جاهزة
- Logging تفصيلي مضاف

❌ **ناقص**:
- Redis غير مثبت/شغال
- بمجرد تشغيل Redis، كل شيء سيشتغل تلقائياً!

## الخطوات التالية

1. اختر أحد خيارات تثبيت Redis أعلاه
2. تأكد من أن Redis شغال (port 6379)
3. شغّل Celery worker بالأمر أعلاه
4. جرّب إنشاء طلب جديد
5. راقب الترمينال - ستشاهد:
   - 📥 رد المزود الكامل
   - 🔍 تفاصيل الحالة
   - 🗺️ Status mapping
   - 💾 SQL update query
   - ✅ عدد الصفوف المتأثرة

## ملاحظة مهمة

النظام **كله جاهز** ويحتاج فقط Redis ليبدأ العمل! 🚀
