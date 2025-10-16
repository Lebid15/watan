"""
Helper functions لتسجيل معاملات المحفظة تلقائياً
"""
from decimal import Decimal
from apps.users.wallet_models import WalletTransaction
from apps.users.models import User


def record_wallet_transaction(
    user: User,
    transaction_type: str,
    amount: Decimal,
    description: str,
    order_id: str = None,
    payment_id: str = None,
    created_by: User = None,
    metadata: dict = None,
    balance_before: Decimal = None,
):
    """
    تسجيل معاملة محفظة
    
    Args:
        user: المستخدم
    transaction_type: نوع العملية (approved, rejected, status_change, deposit, deposit_reversal)
        amount: المبلغ (موجب دائماً - سيتم تحويله للسالب تلقائياً للخصم)
        description: وصف العملية
        order_id: رقم الطلب المرتبط (اختياري)
        payment_id: رقم عملية الدفع (اختياري)
        created_by: من قام بالعملية (للتعديلات اليدوية)
        metadata: معلومات إضافية (اختياري)
        balance_before: الرصيد قبل العملية (اختياري - سيُحسب من user.balance إن لم يُمرر)
    
    Returns:
        WalletTransaction: المعاملة المسجلة
    """
    # التأكد من أن المبلغ موجب
    amount = abs(Decimal(str(amount)))
    
    # حفظ الرصيد قبل العملية (إما من المعامل أو من user.balance الحالي)
    if balance_before is None:
        balance_before = Decimal(str(user.balance))
    else:
        balance_before = Decimal(str(balance_before))
    
    # حساب الرصيد بعد العملية
    if transaction_type in ['approved', 'status_change', 'deposit_reversal']:
        # قبول/تغيير حالة/إلغاء شحن: نطرح من الرصيد (خصم)
        balance_after = balance_before - amount
        amount_signed = -amount  # نجعل المبلغ سالب للتسجيل
    elif transaction_type == 'rejected':
        # رفض: نضيف للرصيد (استرجاع)
        balance_after = balance_before + amount
        amount_signed = amount  # نبقي المبلغ موجب
    else:
        # deposit: نضيف للرصيد
        balance_after = balance_before + amount
        amount_signed = amount  # نبقي المبلغ موجب
    
    # إنشاء سجل المعاملة
    transaction = WalletTransaction.objects.create(
        user=user,
        transaction_type=transaction_type,
        amount=amount_signed,
        currency=user.currency or 'USD',
        balance_before=balance_before,
        balance_after=balance_after,
        description=description,
        order_id=order_id,
        payment_id=payment_id,
        created_by=created_by,
        metadata=metadata or {},
    )
    
    return transaction
