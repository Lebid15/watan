from __future__ import annotations

from django.db import models


class ProviderAPI(models.Model):
    class Meta:
        db_table = 'provider_api'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True, null=True)
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=60, null=True)
    is_active = models.BooleanField(default=True, db_column='isActive')
    settings = models.JSONField(null=True)
    created_at = models.DateTimeField(db_column='createdAt', null=True)
    updated_at = models.DateTimeField(db_column='updatedAt', null=True)


class PackageMapping(models.Model):
    class Meta:
        db_table = 'package_mappings'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True, null=True)
    our_package_id = models.CharField(max_length=120, db_column='our_package_id')
    provider_api_id = models.CharField(max_length=120, db_column='provider_api_id')
    provider_package_id = models.CharField(max_length=120, db_column='provider_package_id')
    meta = models.JSONField(null=True)


class Integration(models.Model):
    class Meta:
        db_table = 'integrations'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    name = models.CharField(max_length=120)
    provider = models.CharField(max_length=20)
    scope = models.CharField(max_length=10, default='tenant')
    base_url = models.CharField(max_length=255, null=True, db_column='baseUrl')
    api_token = models.CharField(max_length=255, null=True, db_column='apiToken')
    kod = models.CharField(max_length=120, null=True)
    sifre = models.CharField(max_length=120, null=True)
    enabled = models.BooleanField(default=True)
    balance = models.DecimalField(max_digits=18, decimal_places=3, null=True)
    balance_updated_at = models.DateTimeField(null=True, db_column='balanceUpdatedAt')
    debt = models.DecimalField(max_digits=18, decimal_places=3, null=True, default=0)
    debt_updated_at = models.DateTimeField(null=True, db_column='debtUpdatedAt')
    created_at = models.DateTimeField(db_column='createdAt')


class PackageRouting(models.Model):
    """
    نموذج إعدادات توجيه الباقات مع التحقق من الصحة
    """
    
    class Meta:
        db_table = 'package_routing'
        managed = False
        # إضافة فهارس مركبة لتحسين الأداء
        indexes = [
            models.Index(fields=['tenant_id', 'package_id']),
            models.Index(fields=['tenant_id', 'provider_type']),
            models.Index(fields=['mode', 'provider_type']),
        ]

    # الحقول الأساسية
    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    package_id = models.UUIDField(db_column='package_id')
    
    # إعدادات التوجيه
    mode = models.CharField(
        max_length=10, 
        default='manual',
        choices=[
            ('manual', 'يدوي'),
            ('auto', 'تلقائي'),
        ],
        help_text='وضع التوجيه: يدوي أو تلقائي'
    )
    
    provider_type = models.CharField(
        max_length=32, 
        db_column='providerType', 
        default='manual',
        choices=[
            ('manual', 'يدوي'),
            ('external', 'خارجي'),
            ('internal_codes', 'أكواد داخلية'),
            ('codes', 'أكواد'),  # للتوافق مع الإصدارات القديمة
        ],
        help_text='نوع المزود المستخدم في التوجيه'
    )
    
    # معرفات المزودين
    primary_provider_id = models.CharField(
        max_length=255, 
        null=True, 
        blank=True,
        db_column='primaryProviderId',
        help_text='معرف المزود الأساسي'
    )
    
    fallback_provider_id = models.CharField(
        max_length=255, 
        null=True, 
        blank=True,
        db_column='fallbackProviderId',
        help_text='معرف المزود الاحتياطي'
    )
    
    # إعدادات الأكواد الداخلية
    code_group_id = models.UUIDField(
        null=True, 
        blank=True,
        db_column='codeGroupId',
        help_text='معرف مجموعة الأكواد للمزود الداخلي'
    )
    
    # حقول إضافية للتحسين
    # priority = models.IntegerField(
    #     default=1,
    #     help_text='أولوية التوجيه (1 = أعلى أولوية)'
    # )
    
    # is_active = models.BooleanField(
    #     default=True,
    #     help_text='هل التوجيه نشط؟'
    # )
    
    # created_at = models.DateTimeField(
    #     auto_now_add=True,
    #     help_text='تاريخ الإنشاء'
    # )
    
    # updated_at = models.DateTimeField(
    #     auto_now=True,
    #     help_text='تاريخ آخر تحديث'
    # )
    
    def clean(self):
        """التحقق من صحة البيانات قبل الحفظ"""
        from .validators import PackageRoutingValidator
        
        routing_data = {
            'mode': self.mode,
            'provider_type': self.provider_type,
            'primary_provider_id': self.primary_provider_id,
            'fallback_provider_id': self.fallback_provider_id,
            'code_group_id': self.code_group_id,
        }
        
        validation_result = PackageRoutingValidator.validate_routing_config(routing_data)
        
        if not validation_result['is_valid']:
            errors = []
            for error in validation_result['errors']:
                errors.append(f"{error['field']}: {error['message']}")
            raise ValidationError(errors)
    
    def save(self, *args, **kwargs):
        """حفظ مع التحقق من الصحة"""
        self.clean()
        super().save(*args, **kwargs)
    
    def get_routing_info(self):
        """معلومات التوجيه بصيغة مقروءة"""
        info = {
            'mode': self.get_mode_display(),
            'provider_type': self.get_provider_type_display(),
            'primary_provider': self.primary_provider_id or 'غير محدد',
            'fallback_provider': self.fallback_provider_id or 'غير محدد',
            'code_group': str(self.code_group_id) if self.code_group_id else 'غير محدد',
            'priority': 1,  # Default priority
            'is_active': 'نشط',  # Default to active
        }
        return info
    
    def __str__(self):
        return f"Routing: {self.tenant_id} -> {self.package_id} ({self.mode}/{self.provider_type})"


class PackageCost(models.Model):
    class Meta:
        db_table = 'package_costs'
        managed = False

    id = models.UUIDField(primary_key=True)
    tenant_id = models.UUIDField(db_column='tenantId', db_index=True)
    package_id = models.UUIDField(db_column='package_id')
    provider_id = models.CharField(max_length=255, db_column='providerId')
    cost_currency = models.CharField(max_length=10, db_column='costCurrency', default='USD')
    cost_amount = models.DecimalField(max_digits=10, decimal_places=2, db_column='costAmount', default=0)