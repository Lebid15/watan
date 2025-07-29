from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
import secrets  # ← لتوليد توكن فريد وثابت
from django.utils.timezone import now

# ✅ موديل العملات (انقله إلى الأعلى قبل الاستخدام)
class Currency(models.Model):
    name = models.CharField(max_length=100, unique=True)  # مثل: ليرة تركية
    code = models.CharField(max_length=10, unique=True)   # مثل: TRY, SYP, USD
    symbol = models.CharField(max_length=5, default='')   # مثل: ₺, $, ل.س
    rate_to_usd = models.DecimalField(max_digits=10, decimal_places=4, default=1.0)  # كم يساوي من الدولار
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


# ✅ مجموعة الأسعار
class PriceGroup(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ✅ مدير المستخدمين
class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("البريد الإلكتروني مطلوب")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


# ✅ المستخدم المخصص
class CustomUser(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    country_code = models.CharField(max_length=5)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # ✅ العملة (استخدمنا اسم الموديل كسلسلة لتفادي التعارض)
    currency = models.ForeignKey('Currency', on_delete=models.SET_NULL, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    api_token = models.CharField(max_length=64, unique=True, blank=True, null=True)  # توكن ثابت
    date_joined = models.DateTimeField(default=now)  # تاريخ التسجيل

    # ✅ ربط المستخدم بمجموعة أسعار
    price_group = models.ForeignKey(PriceGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name', 'phone', 'country_code']

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if not self.api_token:
            self.api_token = secrets.token_hex(32)
        super().save(*args, **kwargs)
