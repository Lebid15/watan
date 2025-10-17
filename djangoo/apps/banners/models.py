from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid


class Banner(models.Model):
    """
    نموذج لصور السلايدر في الصفحة الرئيسية
    يمكن للمستأجر إضافة حتى 3 صور
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # الصورة
    image = models.ImageField(
        upload_to='banners/',
        verbose_name='الصورة',
        help_text='حجم مناسب: 1200x400 بكسل'
    )
    
    # معلومات المستأجر
    tenant_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name='معرف المستأجر',
        help_text='إذا كان فارغاً، سيظهر لجميع المستأجرين'
    )
    
    # الترتيب
    order = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(2)],
        verbose_name='الترتيب',
        help_text='من 0 إلى 2 (الحد الأقصى 3 صور)'
    )
    
    # الحالة
    is_active = models.BooleanField(
        default=True,
        verbose_name='نشط'
    )
    
    # رابط اختياري
    link = models.URLField(
        blank=True,
        null=True,
        verbose_name='الرابط',
        help_text='رابط اختياري عند النقر على الصورة'
    )
    
    # التواريخ
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')
    
    class Meta:
        db_table = 'dj_banners'
        verbose_name = 'صورة سلايدر'
        verbose_name_plural = 'صور السلايدر'
        ordering = ['order', '-created_at']
        indexes = [
            models.Index(fields=['tenant_id', 'is_active']),
            models.Index(fields=['order']),
        ]
    
    def __str__(self):
        return f"Banner {self.order + 1} - {self.tenant_id or 'عام'}"
    
    @classmethod
    def get_active_banners(cls, tenant_id=None):
        """
        جلب الصور النشطة للمستأجر فقط (عزل تام)
        """
        if not tenant_id:
            # إذا لم يتم تحديد المستأجر، إرجاع قائمة فارغة
            return cls.objects.none()
        
        # جلب الصور الخاصة بالمستأجر فقط (عزل تام)
        queryset = cls.objects.filter(
            is_active=True,
            tenant_id=tenant_id
        )
        
        return queryset.order_by('order')[:3]  # حد أقصى 3 صور
