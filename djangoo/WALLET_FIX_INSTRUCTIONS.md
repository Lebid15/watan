# ========================================
# خطوات تطبيق الإصلاح
# ========================================

## 1. إعادة تشغيل Django Server
يجب إعادة تشغيل السيرفر حتى يقرأ الإعداد الجديد:

```powershell
# إيقاف السيرفر الحالي (Ctrl+C)
# ثم إعادة تشغيله:
cd F:\watan\djangoo
.venv\scripts\activate
python manage.py runserver
```

## 2. إعادة تشغيل Celery Worker (إذا كان يعمل)
Celery worker يحتاج أيضاً لقراءة الإعداد الجديد:

```powershell
# إيقاف Celery worker الحالي (Ctrl+C)
# ثم إعادة تشغيله:
cd F:\watan\djangoo
.venv\scripts\activate
.\START_CELERY_ONLY.ps1
```

## 3. اختبار الإصلاح

### خطوات الاختبار:
1. إنشاء طلب جديد من Khalil (عبر Al-Sham)
2. تسجيل الرصيد قبل الطلب
3. إرسال الطلب والتحقق من خصم المبلغ
4. رفض الطلب يدوياً
5. التحقق من استرجاع المبلغ في محفظة Khalil

### النتيجة المتوقعة:
```
قبل الطلب:     19,297.90₺
بعد الطلب:     19,087.90₺  (خصم 210₺) ✅
بعد الرفض:     19,297.90₺  (استرجاع 210₺) ✅
```

## 4. التحقق من Logs

يمكنك التحقق من أن الدالة تعمل بفحص logs:

```
Chain wallet update started
Chain wallet update: Refunding money
```

## ملاحظات مهمة:

1. ✅ `FF_CHAIN_STATUS_PROPAGATION` الآن مفعّل بشكل دائم (القيمة الافتراضية = "1")
2. ✅ يمكن تعطيله عبر متغير بيئي إذا لزم الأمر:
   ```
   FF_CHAIN_STATUS_PROPAGATION=0
   ```
3. ✅ الكود يعمل على جميع مستويات السلسلة:
   - Khalil → Al-Sham ✅
   - Diana → ShamTech ✅
   - ShamTech → ZNET ✅

## الملفات المعدّلة:

1. `djangoo/config/settings.py`
   - تفعيل `FF_CHAIN_STATUS_PROPAGATION`

2. `djangoo/apps/orders/services.py`
   - إضافة دالة `_update_wallet_for_chain_status_change()`
   - إضافة استدعاء الدالة في `_apply_chain_updates()`
   - إضافة logging مفصل

3. إصلاح GUARDRAIL 2 (تم مسبقاً)
   - السماح بالطلبات المحولة في حالة pending بالتوجيه التلقائي
