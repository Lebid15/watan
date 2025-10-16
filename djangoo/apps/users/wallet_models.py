import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _


class WalletTransaction(models.Model):
    """
    سجل جميع التغييرات على رصيد المحفظة
    """
    class TransactionType(models.TextChoices):
        APPROVED = "approved", _("قبول طلب")  # عند قبول طلب
        REJECTED = "rejected", _("رفض طلب")  # عند رفض طلب
        STATUS_CHANGE = "status_change", _("تغيير الحالة")  # عند إعادة قبول بعد رفض
        DEPOSIT = "deposit", _("شحن المحفظة")  # عند شحن الرصيد
    DEPOSIT_REVERSAL = "deposit_reversal", _("إلغاء شحن المحفظة")  # عند سحب الرصيد بعد رفض الإيداع

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="wallet_transactions",
        verbose_name=_("المستخدم")
    )
    
    # نوع العملية
    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices,
        verbose_name=_("نوع العملية")
    )
    
    # المبلغ (موجب للإضافة، سالب للخصم)
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        verbose_name=_("المبلغ")
    )
    
    # العملة
    currency = models.CharField(
        max_length=10,
        default="USD",
        verbose_name=_("العملة")
    )
    
    # الرصيد قبل العملية
    balance_before = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        verbose_name=_("الرصيد قبل")
    )
    
    # الرصيد بعد العملية
    balance_after = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        verbose_name=_("الرصيد بعد")
    )
    
    # الوصف/السبب
    description = models.CharField(
        max_length=500,
        verbose_name=_("الوصف")
    )
    
    # رقم الطلب المرتبط (إن وجد)
    order_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_("رقم الطلب")
    )
    
    # رقم عملية الدفع المرتبطة (إن وجد)
    payment_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_("رقم عملية الدفع")
    )
    
    # من قام بالعملية (للتعديلات اليدوية)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wallet_transactions_created",
        verbose_name=_("تم بواسطة")
    )
    
    # التاريخ والوقت
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_("تاريخ الإنشاء"),
        db_index=True
    )
    
    # معلومات إضافية (JSON)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_("معلومات إضافية")
    )

    class Meta:
        db_table = "wallet_transactions"
        verbose_name = _("معاملة محفظة")
        verbose_name_plural = _("معاملات المحفظة")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["transaction_type"]),
            models.Index(fields=["order_id"]),
        ]

    def __str__(self):
        sign = "+" if self.amount >= 0 else ""
        return f"{self.user.username} - {self.get_transaction_type_display()} - {sign}{self.amount} {self.currency}"
