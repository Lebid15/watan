#!/usr/bin/env python3
"""
Setup script for staging environment with baseline logic enforcement.

This script sets up the staging environment with the required feature flags:
- FF_USD_COST_ENFORCEMENT=1
- FF_CHAIN_STATUS_PROPAGATION=1
- FF_AUTO_FALLBACK_ROUTING=0
- DJ_ZNET_SIMULATE=false
"""

import os
import sys
from pathlib import Path

def setup_staging_environment():
    """Set up staging environment variables."""
    
    # Set feature flags for staging
    os.environ['FF_USD_COST_ENFORCEMENT'] = '1'
    os.environ['FF_CHAIN_STATUS_PROPAGATION'] = '1'
    os.environ['FF_AUTO_FALLBACK_ROUTING'] = '0'
    os.environ['DJ_ZNET_SIMULATE'] = 'false'
    os.environ['DJ_DEBUG_LOGS'] = '1'
    
    # Set Django settings
    os.environ['DJANGO_SETTINGS_MODULE'] = 'config.staging_settings'
    
    print("✅ Staging environment configured with baseline logic enforcement")
    print("   - FF_USD_COST_ENFORCEMENT=1")
    print("   - FF_CHAIN_STATUS_PROPAGATION=1")
    print("   - FF_AUTO_FALLBACK_ROUTING=0")
    print("   - DJ_ZNET_SIMULATE=false")
    print("   - DJ_DEBUG_LOGS=1")

def verify_staging_config():
    """Verify staging configuration."""
    
    from django.conf import settings
    
    print("\n🔍 Verifying staging configuration...")
    
    # Check feature flags
    flags = {
        'FF_USD_COST_ENFORCEMENT': getattr(settings, 'FF_USD_COST_ENFORCEMENT', False),
        'FF_CHAIN_STATUS_PROPAGATION': getattr(settings, 'FF_CHAIN_STATUS_PROPAGATION', False),
        'FF_AUTO_FALLBACK_ROUTING': getattr(settings, 'FF_AUTO_FALLBACK_ROUTING', False),
    }
    
    for flag, value in flags.items():
        status = "✅" if value else "❌"
        print(f"   {status} {flag} = {value}")
    
    # Check simulation mode
    simulate = os.getenv('DJ_ZNET_SIMULATE', '').lower() in ('1', 'true', 'yes', 'on')
    status = "❌" if simulate else "✅"
    print(f"   {status} DJ_ZNET_SIMULATE = {not simulate} (disabled)")
    
    print("\n🎯 Staging environment ready for baseline logic enforcement!")

if __name__ == '__main__':
    setup_staging_environment()
    verify_staging_config()




