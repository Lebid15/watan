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
        
        serializer = WalletTransactionSerializer(page_obj.object_list, many=True)
        
        return Response({
            'transactions': serializer.data,
            'total': paginator.count,
            'page': page_num,
            'page_size': page_size,
            'total_pages': paginator.num_pages,
        })
