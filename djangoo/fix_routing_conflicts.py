#!/usr/bin/env python
"""
Script to fix routing conflicts and improve system health
سكريبت لإصلاح تضارب التوجيه وتحسين صحة النظام
"""

import os
import sys
import django
from django.db import transaction

# إعداد Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'djangoo.settings')
django.setup()

from apps.providers.models import PackageRouting
from apps.orders.models import Order
from apps.providers.validators import PackageRoutingValidator, RoutingHealthChecker


def fix_routing_conflicts():
    """إصلاح تضارب إعدادات التوجيه"""
    print("🔧 Starting routing conflicts fix...")
    
    fixed_count = 0
    errors = []
    
    # 1. إصلاح التضارب بين mode=auto و provider_type=manual
    print("\n1. Fixing auto/manual conflicts...")
    
    conflicting_routings = PackageRouting.objects.filter(
        mode='auto',
        provider_type='manual'
    )
    
    for routing in conflicting_routings:
        try:
            with transaction.atomic():
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
            error_msg = f"Failed to fix routing {routing.id}: {str(e)}"
            print(f"   ❌ {error_msg}")
            errors.append(error_msg)
    
    # 2. إصلاح التوجيهات التلقائية بدون مزود
    print("\n2. Fixing auto routings without providers...")
    
    auto_without_provider = PackageRouting.objects.filter(
        mode='auto',
        provider_type='external',
        primary_provider_id__isnull=True
    )
    
    for routing in auto_without_provider:
        try:
            with transaction.atomic():
                # تغيير الوضع ليدوي إذا لم يوجد مزود
                routing.mode = 'manual'
                routing.save()
                print(f"   ✅ Fixed routing {routing.id}: Changed mode to manual (no provider)")
                fixed_count += 1
                
        except Exception as e:
            error_msg = f"Failed to fix routing {routing.id}: {str(e)}"
            print(f"   ❌ {error_msg}")
            errors.append(error_msg)
    
    # 3. إصلاح التوجيهات التلقائية للأكواد بدون مجموعة
    print("\n3. Fixing auto codes routings without code groups...")
    
    auto_codes_without_group = PackageRouting.objects.filter(
        mode='auto',
        provider_type__in=['codes', 'internal_codes'],
        code_group_id__isnull=True
    )
    
    for routing in auto_codes_without_group:
        try:
            with transaction.atomic():
                # تغيير الوضع ليدوي إذا لم توجد مجموعة أكواد
                routing.mode = 'manual'
                routing.save()
                print(f"   ✅ Fixed routing {routing.id}: Changed mode to manual (no code group)")
                fixed_count += 1
                
        except Exception as e:
            error_msg = f"Failed to fix routing {routing.id}: {str(e)}"
            print(f"   ❌ {error_msg}")
            errors.append(error_msg)
    
    # 4. إصلاح التكرار في المزودين
    print("\n4. Fixing duplicate providers...")
    
    # تجميع التوجيهات حسب المستأجر والباقة
    from django.db.models import Count
    
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
                try:
                    routing.delete()
                    print(f"   ✅ Deleted duplicate routing {routing.id}")
                    fixed_count += 1
                except Exception as e:
                    error_msg = f"Failed to delete duplicate routing {routing.id}: {str(e)}"
                    print(f"   ❌ {error_msg}")
                    errors.append(error_msg)
    
    print(f"\n✅ Fixed {fixed_count} routing conflicts")
    if errors:
        print(f"❌ {len(errors)} errors occurred:")
        for error in errors:
            print(f"   - {error}")
    
    return fixed_count, errors


def validate_all_routings():
    """التحقق من صحة جميع إعدادات التوجيه"""
    print("\n🔍 Validating all routing configurations...")
    
    health_checker = RoutingHealthChecker()
    total_routings = PackageRouting.objects.count()
    valid_count = 0
    invalid_count = 0
    
    for routing in PackageRouting.objects.all():
        routing_data = {
            'mode': routing.mode,
            'provider_type': routing.provider_type,
            'primary_provider_id': routing.primary_provider_id,
            'fallback_provider_id': routing.fallback_provider_id,
            'code_group_id': routing.code_group_id,
        }
        
        validation_result = PackageRoutingValidator.validate_routing_config(routing_data)
        
        if validation_result['is_valid']:
            valid_count += 1
        else:
            invalid_count += 1
            print(f"   ❌ Invalid routing {routing.id}: {validation_result['errors']}")
    
    print(f"✅ Valid routings: {valid_count}")
    print(f"❌ Invalid routings: {invalid_count}")
    print(f"📊 Success rate: {(valid_count / total_routings * 100):.1f}%" if total_routings > 0 else "📊 No routings found")
    
    return valid_count, invalid_count


def generate_health_report():
    """إنتاج تقرير صحة شامل"""
    print("\n📊 Generating comprehensive health report...")
    
    health_checker = RoutingHealthChecker()
    
    # فحص صحة كل مستأجر
    tenants = PackageRouting.objects.values_list('tenant_id', flat=True).distinct()
    
    for tenant_id in tenants:
        print(f"\n🏢 Tenant: {tenant_id}")
        health = health_checker.check_routing_health(tenant_id)
        
        if health['is_healthy']:
            print("   ✅ System is healthy")
        else:
            print("   ❌ System has issues:")
            for issue in health['issues']:
                print(f"      - {issue['message']}")
        
        if health['recommendations']:
            print("   💡 Recommendations:")
            for rec in health['recommendations']:
                print(f"      - {rec}")


def main():
    """الدالة الرئيسية"""
    print("🚀 Starting routing system health improvement...")
    
    try:
        # 1. إصلاح التضارب
        fixed_count, errors = fix_routing_conflicts()
        
        # 2. التحقق من الصحة
        valid_count, invalid_count = validate_all_routings()
        
        # 3. إنتاج تقرير الصحة
        generate_health_report()
        
        print(f"\n🎉 Health improvement completed!")
        print(f"   - Fixed {fixed_count} conflicts")
        print(f"   - Valid routings: {valid_count}")
        print(f"   - Invalid routings: {invalid_count}")
        
        if errors:
            print(f"   - Errors: {len(errors)}")
            return 1
        
        return 0
        
    except Exception as e:
        print(f"❌ Script failed: {str(e)}")
        return 1


if __name__ == '__main__':
    sys.exit(main())