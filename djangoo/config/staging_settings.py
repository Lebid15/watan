"""
Staging settings for baseline logic enforcement.

This file contains the staging configuration with the required feature flags:
- FF_USD_COST_ENFORCEMENT=1
- FF_CHAIN_STATUS_PROPAGATION=1  
- FF_AUTO_FALLBACK_ROUTING=0
- DJ_ZNET_SIMULATE=false
"""

import os
from .settings import *

# Override feature flags for staging
os.environ.setdefault('FF_USD_COST_ENFORCEMENT', '1')
os.environ.setdefault('FF_CHAIN_STATUS_PROPAGATION', '1')
os.environ.setdefault('FF_AUTO_FALLBACK_ROUTING', '0')
os.environ.setdefault('DJ_ZNET_SIMULATE', 'false')

# Re-import feature flags with staging values
FF_USD_COST_ENFORCEMENT = True
FF_CHAIN_STATUS_PROPAGATION = True
FF_AUTO_FALLBACK_ROUTING = False

# Ensure simulation mode is disabled
DJ_ZNET_SIMULATE = False

# Staging-specific settings
DEBUG = False
ALLOWED_HOSTS = ['*']  # Configure appropriately for staging

# Logging configuration for staging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'apps.orders.services': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.providers.adapters': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}




