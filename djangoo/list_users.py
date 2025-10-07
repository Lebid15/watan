#!/usr/bin/env python
"""
سكريبت لعرض جميع المستخدمين مع معلوماتهم
"""
import os
import sys
import django

# إعداد Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.users.models import User

print("=" * 80)
print("قائمة المستخدمين في النظام")
print("=" * 80)

users = User.objects.all().order_by('-date_joined')

for user in users:
    print(f"\n{'─' * 80}")
    print(f"ID: {user.id}")
    print(f"اسم المستخدم: {user.username}")
    print(f"البريد الإلكتروني: {user.email}")
    print(f"الاسم الكامل: {user.get_full_name() or 'غير محدد'}")
    print(f"الدور: {user.get_role_display()}")
    print(f"الحالة: {user.get_status_display()}")
    print(f"نشط: {'نعم' if user.is_active else 'لا'}")
    print(f"مدير: {'نعم' if user.is_staff else 'لا'}")
    print(f"مدير عام: {'نعم' if user.is_superuser else 'لا'}")
    print(f"تاريخ التسجيل: {user.date_joined.strftime('%Y-%m-%d %H:%M')}")
    print(f"آخر تسجيل دخول: {user.last_login.strftime('%Y-%m-%d %H:%M') if user.last_login else 'لم يسجل دخول'}")

print(f"\n{'=' * 80}")
print(f"إجمالي عدد المستخدمين: {users.count()}")
print("=" * 80)
