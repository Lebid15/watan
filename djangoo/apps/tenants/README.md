# Tenants App - Legacy Models

## ⚠️ Important Notice

This app contains **LEGACY MODELS ONLY** from the old NestJS backend.

### Legacy Models (DO NOT USE for new development):
- `Tenant` - maps to `tenant` table (old backend)
- `TenantDomain` - maps to `tenant_domain` table (old backend)

### Purpose:
These models are kept ONLY for:
1. **Reference** - to understand the old tenant schema
2. **Data Migration** - if needed to migrate old tenant data
3. **Comparison** - when implementing new Django tenant features

### For New Development Use:

| Old Model | New Django Model | Location |
|-----------|------------------|----------|
| `Tenant` | `Tenant` | `apps.tenancy.models` |
| `TenantDomain` | (Managed in Tenant model) | `apps.tenancy.models` |

### Key Differences:

#### Old Tenant Model (NestJS):
- Table: `tenant`
- Fields: `id`, `name`, `code`, `owner_user_id`, `is_active`, etc.
- Multi-table structure with separate `tenant_domain` table

#### New Tenant Model (Django):
- Table: `dj_tenants`
- Fields: `id`, `host`, `name`, `is_active`, etc.
- Simplified structure with host-based routing

### Status:
- ❌ **NOT registered** in Django admin
- ❌ **NOT managed** by Django (`managed=False`)
- ✅ **READ ONLY** - can query but cannot modify through Django
- ✅ **Kept for reference** - safe to keep in codebase

### Migration Path:
When ready to fully migrate away from old tenant system:
1. Ensure all data is in `dj_tenants` table
2. Update any references to old tenant tables
3. Delete this app entirely OR keep for historical reference

---
**Last Updated:** October 7, 2025  
**Status:** Legacy Reference Only - Do Not Use  
**Use Instead:** `apps.tenancy.models.Tenant`
