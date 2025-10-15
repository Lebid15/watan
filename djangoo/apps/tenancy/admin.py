from django import forms
from django.contrib import admin
from django.contrib.auth.hashers import make_password
from django.contrib import messages
from django.db import transaction
from django.utils.translation import gettext_lazy as _
from .models import Tenant


class TenantCreateForm(forms.ModelForm):
    """نموذج إنشاء مستأجر مع حقول المستخدم المالك"""
    
    owner_username = forms.CharField(
        label=_('اسم المستخدم'),
        max_length=150,
        required=False,
        help_text=_('اسم المستخدم للمالك (سيتم إنشاء حساب تلقائياً)')
    )
    
    owner_email = forms.EmailField(
        label=_('البريد الإلكتروني'),
        required=False,
        help_text=_('بريد المالك الإلكتروني')
    )
    
    owner_password = forms.CharField(
        label=_('كلمة السر'),
        widget=forms.PasswordInput,
        required=False,
        help_text=_('كلمة سر المالك (إذا تركتها فارغة سيتم استخدام: changeme123)')
    )
    
    owner_balance = forms.DecimalField(
        label=_('الرصيد الابتدائي'),
        initial=0,
        required=False,
        help_text=_('الرصيد الابتدائي للمالك')
    )
    
    owner_currency = forms.ChoiceField(
        label=_('العملة'),
        choices=[('USD', 'USD'), ('TRY', 'TRY'), ('EUR', 'EUR')],
        initial='USD',
        required=False,
    )
    
    class Meta:
        model = Tenant
        fields = ['host', 'name', 'is_active']


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("id", "host", "name", "is_active", "created_at")
    search_fields = ("host", "name")
    list_filter = ("is_active",)
    
    def get_form(self, request, obj=None, **kwargs):
        """استخدام نموذج مخصص عند الإنشاء"""
        if obj is None:  # إنشاء جديد
            kwargs['form'] = TenantCreateForm
        return super().get_form(request, obj, **kwargs)
    
    def get_fieldsets(self, request, obj=None):
        """تخصيص fieldsets حسب العملية (إنشاء/تعديل)"""
        if obj:  # تعديل - عرض حقول المستأجر فقط
            return (
                (_('معلومات المستأجر'), {
                    'fields': ('host', 'name', 'is_active')
                }),
            )
        else:  # إنشاء جديد - عرض حقول المستأجر + حقول المستخدم المالك
            return (
                (_('معلومات المستأجر'), {
                    'fields': ('host', 'name', 'is_active')
                }),
                (_('إنشاء مستخدم مالك (اختياري)'), {
                    'fields': ('owner_username', 'owner_email', 'owner_password', 'owner_balance', 'owner_currency'),
                    'classes': ('collapse',),
                    'description': _('قم بملء هذه الحقول لإنشاء مستخدم مالك تلقائياً مع المستأجر.')
                }),
            )
    
    def save_model(self, request, obj, form, change):
        """حفظ المستأجر وإنشاء المستخدم المالك إن وجد"""
        # حفظ المستأجر أولاً
        super().save_model(request, obj, form, change)
        
        # حفظ tenant_uuid للاستخدام لاحقاً
        tenant_uuid = None
        
        # إنشاء سجل في tenant و tenant_domain للمستأجر الجديد (مهم جداً!)
        if not change:
            try:
                from apps.tenants.models import Tenant as LegacyTenant, TenantDomain
                from django.utils import timezone
                import uuid
                
                # إنشاء UUID للمستأجر
                tenant_uuid = uuid.uuid4()
                
                # استخراج code من host (أول جزء قبل النقطة)
                tenant_code = obj.host.split('.')[0]
                
                # حذف أي سجلات قديمة بنفس الـ code أو domain (تنظيف)
                try:
                    from apps.orders.models import LegacyUser
                    TenantDomain.objects.filter(domain=obj.host).delete()
                    LegacyTenant.objects.filter(code=tenant_code).delete()
                    # حذف Legacy Users القديمة لهذا الـ tenant
                    LegacyUser.objects.filter(tenant_id=tenant_uuid).delete()
                except Exception:
                    pass
                
                # 1. إنشاء سجل في جدول tenant القديم (لتجنب foreign key constraint)
                LegacyTenant.objects.create(
                    id=tenant_uuid,
                    name=obj.name or obj.host,
                    code=tenant_code,
                    is_active=obj.is_active,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
                
                # 2. إنشاء سجل في tenant_domain
                TenantDomain.objects.create(
                    id=uuid.uuid4(),
                    domain=obj.host,
                    tenant_id=tenant_uuid,
                    type='subdomain',
                    is_primary=True,
                    is_verified=True,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
                messages.info(request, f'✅ تم إنشاء Tenant في جدول tenant و tenant_domain بنجاح!')
                    
            except ImportError:
                # Models غير موجودة (development mode فقط)
                messages.warning(request, 'تحذير: لم يتم العثور على جداول NestJS القديمة')
            except Exception as e:
                messages.warning(request, f'⚠️ لم نستطع إنشاء Tenant mapping: {str(e)}')
        
        # إنشاء مستخدم مالك فقط عند الإنشاء الجديد
        if not change:
            owner_username = form.cleaned_data.get('owner_username', '').strip()
            owner_email = form.cleaned_data.get('owner_email', '').strip()
            owner_password = form.cleaned_data.get('owner_password', '').strip()
            
            # إذا تم إدخال اسم مستخدم، ننشئ المستخدم
            if owner_username:
                from apps.users.models import User
                from django.db import IntegrityError
                import uuid
                
                # الحصول على Balance و Currency
                owner_balance = form.cleaned_data.get('owner_balance', 0)
                owner_currency = form.cleaned_data.get('owner_currency', 'USD')
                
                # تحقق من أن اسم المستخدم غير موجود مسبقاً
                if User.objects.filter(username=owner_username).exists():
                    messages.error(
                        request,
                        f'⚠️ تم إنشاء المستأجر "{obj.host}" لكن اسم المستخدم "{owner_username}" موجود مسبقاً! يرجى إنشاء المستخدم يدوياً باسم مختلف.'
                    )
                else:
                    try:
                        from apps.orders.models import LegacyUser
                        from django.utils import timezone
                        
                        # استخدام tenant_uuid إذا كان موجوداً، وإلا حاول الحصول عليه من obj.id
                        user_tenant_id = tenant_uuid if tenant_uuid else (obj.id if isinstance(obj.id, uuid.UUID) else None)
                        
                        # إنشاء UUID موحد للمستخدم (سيُستخدم في كلا النظامين)
                        user_uuid = uuid.uuid4()
                        
                        # 1. إنشاء المستخدم في dj_users (Django الجديد)
                        # ⚠️ مهم: يجب أن نحفظ user.id لاستخدامه في LegacyUser
                        user = User.objects.create(
                            username=owner_username,
                            email=owner_email or f"{owner_username}@{obj.host}",
                            password=make_password(owner_password) if owner_password else make_password('changeme123'),
                            tenant_id=user_tenant_id,
                            role=User.Roles.INSTANCE_OWNER,
                            status=User.Status.ACTIVE,
                            balance=owner_balance,
                            currency=owner_currency,
                            is_staff=False,
                            is_superuser=False,
                        )
                        
                        # 2. إنشاء نسخة في جدول users القديم (Legacy)
                        # ⚠️ استخدام ID المستخدم من Django (إن كان UUID) أو user_uuid
                        try:
                            # استخدام نفس كلمة السر المشفرة
                            hashed_password = user.password  # نستخدم الـ password المشفر من Django User
                            
                            # تحديد ID للمستخدم القديم
                            legacy_user_id = user.id if isinstance(user.id, uuid.UUID) else user_uuid
                            
                            LegacyUser.objects.create(
                                id=legacy_user_id,
                                tenant_id=user_tenant_id,
                                email=user.email,
                                username=user.username,
                                password=hashed_password  # إضافة كلمة السر المشفرة
                            )
                            messages.success(
                                request,
                                f'✅ تم إنشاء المستأجر "{obj.host}" والمستخدم المالك "{user.username}" بنجاح (في كلا النظامين)!'
                            )
                        except Exception as legacy_error:
                            # إذا فشل إنشاء Legacy user، المستخدم Django موجود على الأقل
                            messages.warning(
                                request,
                                f'✅ تم إنشاء المستأجر والمستخدم، لكن فشل إنشاء Legacy User: {str(legacy_error)}'
                            )
                        
                        if not owner_password:
                            messages.warning(
                                request,
                                '⚠️ لم تقم بإدخال كلمة سر، تم تعيين كلمة السر الافتراضية: changeme123'
                            )
                        
                    except IntegrityError as e:
                        # في حالة constraint violation
                        messages.error(
                            request,
                            f'⚠️ تم إنشاء المستأجر "{obj.host}" لكن فشل إنشاء المستخدم المالك: {str(e)}'
                        )
                    except Exception as e:
                        # أي خطأ آخر
                        messages.error(
                            request,
                            f'⚠️ تم إنشاء المستأجر "{obj.host}" لكن حدث خطأ: {str(e)}'
                        )
