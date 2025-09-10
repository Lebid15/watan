# Admin Tenants – Smoke Test

Prereqs
- Feature flag ADMIN_TENANT_MGMT=true on backend.
- Account role: instance_owner or admin.

Steps
1) Login to a tenant subdomain as instance_owner/admin.
2) Navigate: Admin → Tenants (/admin/tenants).
3) Verify help banner is visible.
4) List shows Name, Code, Owner, Domains, Status, Actions. Use filters: status=active|trashed|all and Search by code/domain.
5) Edit: pick a row → Edit. Change name/code/ownerEmail/ownerName → Save. Expect success toast.
6) Trash: click Trash → confirm dialog → row becomes Trashed.
7) Restore: click Restore. If 409, dialog prompts to apply suggestion. Click OK to apply and retry → expect success toast.
8) Hard delete: for a trashed tenant, click Hard Delete → type code to confirm → expect success or precondition error.
9) RBAC/flag: with non-authorized role, page shows Access denied.

Screenshots
- Tenants table
- Edit modal
- Conflict suggestion prompt
- Toaster feedback

Notes
- Endpoints: GET/POST/PATCH/DELETE under /api/admin/tenants.
- Suggestions from 409: payload.suggestion.code and payload.suggestion.domains.
