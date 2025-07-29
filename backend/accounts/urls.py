from django.urls import path
from .views import RegisterView, profile_view, get_balance, profile_by_token
from .views import update_user_balance, test_token
from .views_price_groups import (
    price_group_list_create,
    price_group_detail,
    all_packages_with_prices,
    set_user_price_group,
    admin_list_users,
)
from accounts.views import MyTokenObtainPairView
from . import views
from django.urls import path

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('profile/', profile_view, name='profile'),
    path('balance/', get_balance, name='get-balance'),
    path('profile-by-token/', profile_by_token, name='profile-by-token'),

    # ✅ إدارة المستخدمين
    path('admin/users/', admin_list_users),  # ← هذا فقط، حذفنا list_users
    path('admin/users/<int:user_id>/balance/', update_user_balance, name='update-user-balance'),

    # ✅ إدارة مجموعات الأسعار
    path('price-groups/', price_group_list_create, name='pricegroup-list-create'),
    path('price-groups/<int:pk>/', price_group_detail, name='pricegroup-detail'),

    # ✅ التوكن
    path('api/token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('test-token/', test_token),

    # ✅ الباقات مع الأسعار
    path('all-packages/', all_packages_with_prices, name='all-packages'),

    # ✅ ربط المستخدم بالمجموعة
    path('admin/set-user-group/', set_user_price_group),
    path('whoami/', views.whoami, name='whoami'),

    path('currencies/', views.currency_list),
    path('currencies/<int:pk>/', views.update_currency),
]
