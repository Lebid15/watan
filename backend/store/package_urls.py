from django.urls import path
from .views_admin import delete_package, update_package

urlpatterns = [
    path('<int:package_id>/delete/', delete_package, name='delete-package'),
    path('<int:package_id>/update/', update_package, name='update-package'),
]
