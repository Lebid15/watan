from __future__ import annotations

import uuid
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class DashboardAnnouncement(models.Model):
    """
    إعلانات لوحة التحكم - تظهر للمستأجرين في صفحة الداشبورد
    يمكن أن تكون عامة لجميع المستأجرين أو خاصة بمستأجر محدد
    """
    
    ANNOUNCEMENT_TYPES = [
        ('info', 'معلومة'),
        ('success', 'نجاح'),
        ('warning', 'تحذير'),
        ('update', 'تحديث'),
        ('announcement', 'إعلان'),
    ]
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    title = models.CharField(
        max_length=200,
        verbose_name='العنوان',
        help_text='عنوان الإعلان'
    )
    
    content = models.TextField(
        verbose_name='المحتوى',
        help_text='محتوى الإعلان (يدعم HTML)'
    )
    
    announcement_type = models.CharField(
        max_length=20,
        choices=ANNOUNCEMENT_TYPES,
        default='info',
        verbose_name='نوع الإعلان'
    )
    
    icon = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='الأيقونة',
        help_text='اسم الأيقونة (مثل: bell, info-circle, check-circle)'
    )
    
    order = models.IntegerField(
        default=0,
        verbose_name='الترتيب',
        help_text='ترتيب العرض (الأصغر يظهر أولاً)'
    )
    
    is_active = models.BooleanField(
        default=True,
        verbose_name='نشط',
        help_text='هل الإعلان نشط ومرئي؟'
    )
    
    is_global = models.BooleanField(
        default=True,
        verbose_name='عام',
        help_text='إذا كان نعم: يظهر لجميع المستأجرين. إذا كان لا: خاص بمستأجر محدد'
    )
    
    tenant_id = models.UUIDField(
        blank=True,
        null=True,
        db_index=True,
        verbose_name='معرف المستأجر',
        help_text='إذا كان الإعلان خاص بمستأجر معين (اتركه فارغاً للإعلانات العامة)'
    )
    
    start_date = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='تاريخ البدء',
        help_text='تاريخ بدء عرض الإعلان (اختياري)'
    )
    
    end_date = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='تاريخ الانتهاء',
        help_text='تاريخ انتهاء عرض الإعلان (اختياري)'
    )
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_announcements',
        verbose_name='أنشئ بواسطة'
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='تاريخ الإنشاء'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='تاريخ التحديث'
    )
    
    class Meta:
        db_table = 'dj_dashboard_announcements'
        verbose_name = 'إعلان'
        verbose_name_plural = 'الإعلانات'
        ordering = ['order', '-created_at']
        indexes = [
            models.Index(fields=['is_active', 'is_global']),
            models.Index(fields=['tenant_id', 'is_active']),
            models.Index(fields=['order']),
        ]
    
    def __str__(self):
        scope = "عام" if self.is_global else f"خاص - {self.tenant_id}"
        return f"{self.title} ({scope})"
    
    def is_visible_now(self) -> bool:
        """
        فحص إذا كان الإعلان مرئي حالياً بناءً على التواريخ
        """
        if not self.is_active:
            return False
        
        now = timezone.now()
        
        if self.start_date and now < self.start_date:
            return False
        
        if self.end_date and now > self.end_date:
            return False
        
        return True
    
    @classmethod
    def get_active_for_tenant(cls, tenant_id: str = None):
        """
        الحصول على جميع الإعلانات النشطة لمستأجر معين
        تتضمن الإعلانات العامة + الإعلانات الخاصة بالمستأجر
        """
        now = timezone.now()
        
        # بناء الاستعلام الأساسي
        query = cls.objects.filter(
            is_active=True,
        )
        
        # فلترة حسب التواريخ
        query = query.filter(
            models.Q(start_date__isnull=True) | models.Q(start_date__lte=now)
        ).filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=now)
        )
        
        # فلترة حسب المستأجر
        if tenant_id:
            query = query.filter(
                models.Q(is_global=True) | models.Q(tenant_id=tenant_id)
            )
        else:
            query = query.filter(is_global=True)
        
        return query.order_by('order', '-created_at')
