"""
Signals لإنشاء LegacyUser تلقائياً عند إنشاء User جديد
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
import uuid
import logging

from .models import User

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def create_legacy_user(sender, instance, created, **kwargs):
    """
    إنشاء LegacyUser في جدول users القديم تلقائياً
    عند إنشاء User جديد في dj_users
    """
    if not created:
        # فقط عند الإنشاء، ليس عند التعديل
        return
    
    # تحقق من وجود tenant_id
    if not instance.tenant_id:
        logger.warning(f'⚠️ User {instance.username} has no tenant_id - skipping LegacyUser creation')
        return
    
    try:
        from apps.orders.models import LegacyUser
        
        # تحقق من عدم وجود LegacyUser بنفس username/email مسبقاً
        existing = LegacyUser.objects.filter(
            username=instance.username,
            tenant_id=instance.tenant_id
        ).first()
        
        if existing:
            logger.info(f'LegacyUser already exists for username={instance.username}')
            return
        
        # إنشاء LegacyUser جديد
        legacy_user = LegacyUser.objects.create(
            id=uuid.uuid4(),
            tenant_id=instance.tenant_id,
            username=instance.username,
            email=instance.email,
            password=instance.password  # نفس الـ password المشفر من Django
        )
        
        logger.info(f'✅ Created LegacyUser id={legacy_user.id}, username={instance.username}, tenant_id={instance.tenant_id}')
        
    except ImportError:
        # LegacyUser model غير موجود (development mode)
        logger.warning('LegacyUser model not found - skipping')
    except Exception as e:
        # في حالة الخطأ، نسجل فقط ولا نمنع إنشاء User
        logger.error(f'❌ Failed to create LegacyUser for user_id={instance.id}, username={instance.username}: {str(e)}')
