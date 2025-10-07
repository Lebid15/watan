# Orders App - Legacy Models

## ⚠️ Important Notice

This app contains **LEGACY MODELS ONLY** from the old NestJS backend.

### Legacy Models (DO NOT USE for new development):
- `Product` - maps to `product` table
- `ProductPackage` - maps to `product_packages` table  
- `LegacyUser` - maps to `users` table
- `ProductOrder` - maps to `product_orders` table

### Purpose:
These models are kept ONLY for:
1. **Reference** - to understand the old database schema
2. **Data Migration** - if needed to migrate old data
3. **Comparison** - when implementing new Django models

### For New Development Use:

| Old Model | New Django Model | Location |
|-----------|------------------|----------|
| `Product` | `Product` | `apps.products.models` |
| `ProductPackage` | (TBD) | `apps.products.models` |
| `LegacyUser` | `User` | `apps.users.models` |
| `ProductOrder` | (TBD) | Create new model in Django |

### Status:
- ❌ **NOT registered** in Django admin
- ❌ **NOT managed** by Django (`managed=False`)
- ✅ **READ ONLY** - can query but cannot modify through Django
- ✅ **Kept for reference** - safe to keep in codebase

### Migration Path:
When ready to fully migrate away from old backend:
1. Create new Django models for orders
2. Write data migration scripts
3. Delete this app entirely

---
**Last Updated:** October 7, 2025  
**Status:** Legacy Reference Only - Do Not Use
