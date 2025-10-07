#!/usr/bin/env python
"""
سكريبت لتغيير كلمة مرور مستخدم معين
الاستخدام: python change_user_password.py <username_or_email> <new_password>
"""
import os
import sys
import django

# إعداد Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User
from django.db.models import Q

if len(sys.argv) < 3:
    print("الاستخدام: python change_user_password.py <username_or_email> <new_password>")
    print("\nأمثلة:")
    print("  python change_user_password.py admin@example.com NewPassword123")
    print("  python change_user_password.py john_doe NewPassword123")
    sys.exit(1)

username_or_email = sys.argv[1]
new_password = sys.argv[2]

print("=" * 80)
print("تغيير كلمة المرور")
print("=" * 80)

try:
    # البحث عن المستخدم باسم المستخدم أو البريد الإلكتروني
    user = User.objects.get(
        Q(username=username_or_email) | Q(email=username_or_email)
    )
    
    print(f"\nتم العثور على المستخدم:")
    print(f"  اسم المستخدم: {user.username}")
    print(f"  البريد الإلكتروني: {user.email}")
    print(f"  الاسم الكامل: {user.get_full_name() or 'غير محدد'}")
    print(f"  الدور: {user.get_role_display()}")
    
    # تغيير كلمة المرور
    user.set_password(new_password)
    user.save()
    
    print(f"\n✓ تم تغيير كلمة المرور بنجاح!")
    print(f"✓ كلمة المرور الجديدة: {new_password}")
    print("=" * 80)
    
except User.DoesNotExist:
    print(f"\n✗ خطأ: لم يتم العثور على مستخدم بهذا الاسم أو البريد الإلكتروني: {username_or_email}")
    print("\nللحصول على قائمة بجميع المستخدمين، استخدم:")
    print("  python list_users.py")
    print("=" * 80)
    sys.exit(1)
except Exception as e:
    print(f"\n✗ خطأ غير متوقع: {str(e)}")
    print("=" * 80)
    sys.exit(1)
