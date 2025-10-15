# Client API Token Implementation

## التنفيذ الكامل لإدارة API Tokens

تم تطبيق نظام إدارة API Tokens مطابق تماماً لـ NestJS backend القديم.

---

## 1. التغييرات في Models

### `apps/users/models.py`

أضيفت الحقول التالية لـ User model:

```python
# Client API fields (Phase1: matching NestJS backend)
api_enabled = models.BooleanField(default=False, null=True, blank=True)
api_token_revoked = models.BooleanField(default=False, null=True, blank=True)
api_allow_all_ips = models.BooleanField(default=True, null=True, blank=True)
api_allow_ips = models.JSONField(default=list, null=True, blank=True)
api_webhook_url = models.CharField(max_length=300, null=True, blank=True)
api_last_used_at = models.DateTimeField(null=True, blank=True)
api_rate_limit_per_min = models.IntegerField(null=True, blank=True)
api_webhook_enabled = models.BooleanField(default=False, null=True, blank=True)
api_webhook_secret = models.CharField(max_length=64, null=True, blank=True)
api_webhook_sig_version = models.CharField(max_length=10, default='v1', null=True, blank=True)
api_webhook_last_rotated_at = models.DateTimeField(null=True, blank=True)
```

---

## 2. API Endpoints الجديدة

### ملف: `apps/users/client_api_views.py`

#### للمستخدم الحالي (me):

| Method | Endpoint | الوصف |
|--------|----------|-------|
| POST | `/api-dj/tenant/client-api/users/me/generate` | إنشاء API token جديد |
| POST | `/api-dj/tenant/client-api/users/me/rotate` | تجديد API token |
| POST | `/api-dj/tenant/client-api/users/me/revoke` | إبطال API token |
| POST | `/api-dj/tenant/client-api/users/me/enable` | تفعيل الوصول للـ API |
| GET | `/api-dj/tenant/client-api/users/me/settings` | جلب إعدادات API |
| PATCH | `/api-dj/tenant/client-api/users/me/settings` | تحديث إعدادات API |
| POST | `/api-dj/tenant/client-api/users/me/webhook/secret/generate` | إنشاء webhook secret |
| POST | `/api-dj/tenant/client-api/users/me/webhook/secret/rotate` | تجديد webhook secret |

#### للمستخدمين الآخرين (Admin فقط):

| Method | Endpoint | الوصف |
|--------|----------|-------|
| POST | `/api-dj/tenant/client-api/users/<id>/generate` | إنشاء token لمستخدم آخر |

---

## 3. Migration

### ملف: `apps/users/migrations/0010_client_api_fields.py`

يضيف جميع الحقول الجديدة لجدول `dj_users`.

---

## 4. كيفية الاستخدام

### السيناريو الكامل:

#### الخطوة 1: إنشاء Tenant
```
Super Admin → Django Admin → Tenants → Add Tenant
- Code: shamtech
- Name: Shamtech
- Domain: shamtech.localhost
- Owner: omar
```

#### الخطوة 2: المستخدم يسجل حساب جديد
```
User → http://shamtech.localhost:3000/register/
- Username: api_user
- Email: api@shamtech.com
- Password: ******
```

✅ Signal يعمل تلقائياً → User في `dj_users` + LegacyUser في `users`

#### الخطوة 3: المستخدم يولد API Token
```
User → http://shamtech.localhost:3000/account/api/
→ Click "Generate"
→ Token: abc123def456...
```

Frontend يرسل:
```
POST /api-dj/tenant/client-api/users/me/generate
```

Backend يرد:
```json
{
  "token": "abc123def456...",
  "message": "تم إنشاء التوكن بنجاح"
}
```

#### الخطوة 4: مستأجر آخر يستخدم Token
```
Alsham → http://alsham.localhost:3000/admin/products/api-settings/
→ Add Integration
- Name: Shamtech
- Type: internal
- URL: http://shamtech.localhost:3000
- API Token: abc123def456... (من الخطوة 3)
```

---

## 5. الإعدادات المتاحة

عبر `PATCH /api-dj/tenant/client-api/users/me/settings`:

```json
{
  "allowAll": true,              // السماح لكل IPs
  "allowIps": ["1.2.3.4"],       // IPs محددة
  "webhookUrl": "https://...",   // Webhook URL
  "enabled": true,               // تفعيل API
  "rateLimitPerMin": 100         // حد الطلبات بالدقيقة
}
```

---

## 6. Migration الآن

```bash
cd F:\watan\djangoo
python manage.py migrate users
```

---

## 7. اختبار

### 1. إعادة تشغيل Django server:
```bash
python manage.py runserver
```

### 2. اذهب إلى:
```
http://shamtech.localhost:3000/account/api/
```

### 3. اضغط "Generate" → يجب أن يظهر Token

### 4. النتيجة المتوقعة:
- ✅ Token: `abc123...` (40 حرف hex)
- ✅ حقل `api_token` في database يتم تحديثه
- ✅ `api_enabled = True`
- ✅ `api_token_revoked = False`

---

## 8. Troubleshooting

### المشكلة: Frontend يعطي 404
**الحل:** تأكد من إعادة تشغيل Django server

### المشكلة: Token لا يظهر
**الحل:** تحقق من logs في Django console

### المشكلة: Migration تفشل
**الحل:** تحقق من رقم آخر migration في `apps/users/migrations/`

---

## الملفات المعدلة:

1. ✅ `apps/users/models.py` - أضيفت حقول API
2. ✅ `apps/users/client_api_views.py` - **جديد** - Views لإدارة Tokens
3. ✅ `apps/users/client_api_urls.py` - **جديد** - URLs للـ Client API
4. ✅ `config/urls.py` - أضيف include للـ client_api_urls
5. ✅ `apps/users/migrations/0010_client_api_fields.py` - **جديد** - Migration

---

## المطابقة مع NestJS:

| NestJS Endpoint | Django Endpoint | ✅ |
|----------------|-----------------|---|
| `POST /api/tenant/client-api/users/:id/generate` | `POST /api-dj/tenant/client-api/users/me/generate` | ✅ |
| `POST /api/tenant/client-api/users/:id/rotate` | `POST /api-dj/tenant/client-api/users/me/rotate` | ✅ |
| `POST /api/tenant/client-api/users/:id/revoke` | `POST /api-dj/tenant/client-api/users/me/revoke` | ✅ |
| `POST /api/tenant/client-api/users/:id/enable` | `POST /api-dj/tenant/client-api/users/me/enable` | ✅ |
| `GET /api/tenant/client-api/users/:id/settings` | `GET /api-dj/tenant/client-api/users/me/settings` | ✅ |
| `PATCH /api/tenant/client-api/users/:id/settings` | `PATCH /api-dj/tenant/client-api/users/me/settings` | ✅ |

---

## ملاحظات:

- ✅ Frontend لا يحتاج تعديل - يستخدم نفس المسارات
- ✅ Token يتم توليده بـ 40 hex character مثل NestJS تماماً
- ✅ جميع الحقول متطابقة مع NestJS backend
- ✅ Signal يعمل تلقائياً لإنشاء LegacyUser عند التسجيل
