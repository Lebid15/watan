#!/usr/bin/env python
"""
Comprehensive Routing System Fix Script
سكريبت إصلاح شامل لنظام التوجيه
"""

import os
import sys
import django
from django.db import transaction
from django.core.exceptions import ValidationError

# إعداد Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from apps.providers.models import PackageRouting, Integration
from apps.orders.models import ProductOrder
from apps.orders.routing_health_check import routing_health_checker


def fix_routing_system_comprehensive():
    """إصلاح شامل لنظام التوجيه"""
    print("🚀 Starting comprehensive routing system fix...")
    
    fixed_count = 0
    errors = []
    
    try:
        # 1. إصلاح التضارب في الإعدادات
        print("\n1. Fixing routing configuration conflicts...")
        conflicts_fixed = fix_routing_conflicts()
        fixed_count += conflicts_fixed
        
        # 2. إصلاح التوجيهات بدون مزود
        print("\n2. Fixing routings without providers...")
        providers_fixed = fix_routings_without_providers()
        fixed_count += providers_fixed
        
        # 3. إصلاح التوجيهات بدون مجموعة أكواد
        print("\n3. Fixing routings without code groups...")
        codes_fixed = fix_routings_without_codes()
        fixed_count += codes_fixed
        
        # 4. إصلاح التكرار في المزودين
        print("\n4. Fixing duplicate providers...")
        duplicates_fixed = fix_duplicate_providers()
        fixed_count += duplicates_fixed
        
        # 5. إصلاح التوجيهات المعطلة
        print("\n5. Fixing inactive routings...")
        inactive_fixed = fix_inactive_routings()
        fixed_count += inactive_fixed
        
        # 6. فحص صحة النظام
        print("\n6. Checking system health...")
        health_report = check_system_health()
        
        print(f"\n✅ Comprehensive fix completed!")
        print(f"   - Fixed {fixed_count} issues")
        print(f"   - System health: {health_report.get('overall_health', 'unknown')}")
        print(f"   - Issues found: {len(health_report.get('issues', []))}")
        
        if errors:
            print(f"   - Errors: {len(errors)}")
            for error in errors:
                print(f"     - {error}")
        
        return 0
        
    except Exception as e:
        print(f"❌ Comprehensive fix failed: {str(e)}")
        return 1


def fix_routing_conflicts():
    """إصلاح تضارب إعدادات التوجيه"""
    fixed_count = 0
    
    try:
        with transaction.atomic():
            # إصلاح التضارب بين mode=auto و provider_type=manual
            conflicting_routings = PackageRouting.objects.filter(
                mode='auto',
                provider_type='manual'
            )
            
            for routing in conflicting_routings:
                # خيار 1: تغيير الوضع ليدوي
                if not routing.primary_provider_id and not routing.code_group_id:
                    routing.mode = 'manual'
                    routing.save()
                    print(f"   ✅ Fixed routing {routing.id}: Changed mode to manual")
                    fixed_count += 1
                
                # خيار 2: تغيير نوع المزود لخارجي
                elif routing.primary_provider_id:
                    routing.provider_type = 'external'
                    routing.save()
                    print(f"   ✅ Fixed routing {routing.id}: Changed provider_type to external")
                    fixed_count += 1
                
                # خيار 3: تغيير نوع المزود لأكواد داخلية
                elif routing.code_group_id:
                    routing.provider_type = 'internal_codes'
                    routing.save()
                    print(f"   ✅ Fixed routing {routing.id}: Changed provider_type to internal_codes")
                    fixed_count += 1
            
    except Exception as e:
        print(f"   ❌ Failed to fix routing conflicts: {str(e)}")
    
    return fixed_count


def fix_routings_without_providers():
    """إصلاح التوجيهات بدون مزود"""
    fixed_count = 0
    
    try:
        with transaction.atomic():
            routings_without_provider = PackageRouting.objects.filter(
                mode='auto',
                provider_type='external',
                primary_provider_id__isnull=True
            )
            
            for routing in routings_without_provider:
                routing.mode = 'manual'
                routing.save()
                print(f"   ✅ Fixed routing {routing.id}: Changed mode to manual (no provider)")
                fixed_count += 1
            
    except Exception as e:
        print(f"   ❌ Failed to fix routings without providers: {str(e)}")
    
    return fixed_count


def fix_routings_without_codes():
    """إصلاح التوجيهات بدون مجموعة أكواد"""
    fixed_count = 0
    
    try:
        with transaction.atomic():
            routings_without_codes = PackageRouting.objects.filter(
                mode='auto',
                provider_type__in=['codes', 'internal_codes'],
                code_group_id__isnull=True
            )
            
            for routing in routings_without_codes:
                routing.mode = 'manual'
                routing.save()
                print(f"   ✅ Fixed routing {routing.id}: Changed mode to manual (no code group)")
                fixed_count += 1
            
    except Exception as e:
        print(f"   ❌ Failed to fix routings without codes: {str(e)}")
    
    return fixed_count


def fix_duplicate_providers():
    """إصلاح التكرار في المزودين"""
    fixed_count = 0
    
    try:
        with transaction.atomic():
            from django.db.models import Count
            
            # تجميع التوجيهات حسب المستأجر والباقة والمزود
            duplicate_routings = PackageRouting.objects.values(
                'tenant_id', 'package_id', 'primary_provider_id'
            ).annotate(
                count=Count('id')
            ).filter(count__gt=1)
            
            for duplicate in duplicate_routings:
                tenant_id = duplicate['tenant_id']
                package_id = duplicate['package_id']
                provider_id = duplicate['primary_provider_id']
                
                if provider_id:  # تجاهل التوجيهات بدون مزود
                    # الاحتفاظ بأحدث توجيه وحذف الباقي
                    routings_to_keep = PackageRouting.objects.filter(
                        tenant_id=tenant_id,
                        package_id=package_id,
                        primary_provider_id=provider_id
                    ).order_by('-created_at').first()
                    
                    routings_to_delete = PackageRouting.objects.filter(
                        tenant_id=tenant_id,
                        package_id=package_id,
                        primary_provider_id=provider_id
                    ).exclude(id=routings_to_keep.id)
                    
                    for routing in routings_to_delete:
                        routing.delete()
                        print(f"   ✅ Deleted duplicate routing {routing.id}")
                        fixed_count += 1
            
    except Exception as e:
        print(f"   ❌ Failed to fix duplicate providers: {str(e)}")
    
    return fixed_count


def fix_inactive_routings():
    """إصلاح التوجيهات المعطلة"""
    fixed_count = 0
    
    try:
        with transaction.atomic():
            # تفعيل التوجيهات المعطلة التي لها إعدادات صحيحة
            inactive_routings = PackageRouting.objects.filter(
                is_active=False
            )
            
            for routing in inactive_routings:
                # التحقق من صحة الإعدادات
                is_valid = True
                
                if routing.mode == 'auto' and routing.provider_type == 'manual':
                    is_valid = False
                elif routing.mode == 'auto' and routing.provider_type == 'external' and not routing.primary_provider_id:
                    is_valid = False
                elif routing.mode == 'auto' and routing.provider_type in ('codes', 'internal_codes') and not routing.code_group_id:
                    is_valid = False
                
                if is_valid:
                    routing.is_active = True
                    routing.save()
                    print(f"   ✅ Activated routing {routing.id}")
                    fixed_count += 1
                else:
                    print(f"   ⚠️ Skipped invalid routing {routing.id}")
            
    except Exception as e:
        print(f"   ❌ Failed to fix inactive routings: {str(e)}")
    
    return fixed_count


def check_system_health():
    """فحص صحة النظام"""
    try:
        # فحص صحة جميع المستأجرين
        tenants = PackageRouting.objects.values_list('tenant_id', flat=True).distinct()
        
        overall_health = 'healthy'
        total_issues = 0
        
        for tenant_id in tenants:
            health_report = routing_health_checker.check_routing_health(tenant_id)
            issues_count = len(health_report.get('issues', []))
            total_issues += issues_count
            
            if health_report.get('overall_health') == 'critical':
                overall_health = 'critical'
            elif health_report.get('overall_health') == 'warning' and overall_health != 'critical':
                overall_health = 'warning'
        
        return {
            'overall_health': overall_health,
            'total_issues': total_issues,
            'tenants_checked': len(tenants)
        }
        
    except Exception as e:
        print(f"   ❌ Failed to check system health: {str(e)}")
        return {
            'overall_health': 'error',
            'total_issues': 0,
            'tenants_checked': 0
        }


def main():
    """الدالة الرئيسية"""
    print("🎯 Comprehensive Routing System Fix")
    print("=" * 50)
    
    try:
        result = fix_routing_system_comprehensive()
        
        if result == 0:
            print("\n🎉 All fixes completed successfully!")
            print("The routing system should now work perfectly!")
        else:
            print("\n❌ Some fixes failed. Please check the errors above.")
        
        return result
        
    except Exception as e:
        print(f"❌ Script failed: {str(e)}")
        return 1


if __name__ == '__main__':
    sys.exit(main())

