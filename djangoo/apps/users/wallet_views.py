from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.core.paginator import Paginator
from drf_spectacular.utils import extend_schema

from apps.users.wallet_models import WalletTransaction
from apps.users.wallet_serializers import (
    WalletTransactionsListResponseSerializer,
    WalletTransactionSerializer,
)
from apps.payments.models import PaymentMethod


class WalletTransactionsView(APIView):
    """
    API لجلب سجل معاملات المحفظة للمستخدم
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Wallet"],
        responses={200: WalletTransactionsListResponseSerializer}
    )
    def get(self, request):
        """
        جلب سجل معاملات المحفظة للمستخدم الحالي
        
        Query Parameters:
        - page: رقم الصفحة (افتراضي: 1)
        - page_size: عدد العناصر في الصفحة (افتراضي: 20)
        - type: نوع العملية (debit, credit, refund, adjustment) - اختياري
        """
        user = request.user
        page_num = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        transaction_type = request.GET.get('type', None)
        
        # جلب المعاملات الخاصة بالمستخدم
        transactions = WalletTransaction.objects.filter(user=user)
        
        # فلترة حسب النوع إذا تم تحديده
        if transaction_type:
            transactions = transactions.filter(transaction_type=transaction_type)
        
        # ترتيب حسب التاريخ (الأحدث أولاً)
        transactions = transactions.order_by('-created_at')
        
        # Pagination
        paginator = Paginator(transactions, page_size)
        page_obj = paginator.get_page(page_num)

        transactions_list = list(page_obj.object_list)

        method_ids = set()
        metadata_cache = {}

        for tx in transactions_list:
            metadata = getattr(tx, 'metadata', None)
            if isinstance(metadata, dict):
                method_id = metadata.get('method_id') or metadata.get('methodId')
                if method_id:
                    method_id_str = str(method_id)
                    method_ids.add(method_id_str)
                    metadata_cache[method_id_str] = metadata

        payment_methods_map = {}
        if method_ids:
            qs = PaymentMethod.objects.filter(id__in=method_ids)
            for method in qs:
                method_id_str = str(getattr(method, 'id', ''))
                payment_methods_map[method_id_str] = {
                    'id': method_id_str,
                    'name': getattr(method, 'name', None),
                }

        # استعمل الاسم الموجود في الميتاداتا إن لم يكن موجوداً في قاعدة البيانات
        for method_id_str, metadata in metadata_cache.items():
            if method_id_str not in payment_methods_map:
                name_candidate = metadata.get('method_name') or metadata.get('methodName')
                payment_methods_map[method_id_str] = {
                    'id': method_id_str,
                    'name': str(name_candidate) if name_candidate else None,
                }

        serializer = WalletTransactionSerializer(
            transactions_list,
            many=True,
            context={'payment_methods': payment_methods_map},
        )
        
        return Response({
            'transactions': serializer.data,
            'total': paginator.count,
            'page': page_num,
            'page_size': page_size,
            'total_pages': paginator.num_pages,
        })
