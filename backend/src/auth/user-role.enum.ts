export enum UserRole {
  DEVELOPER = 'developer',
  INSTANCE_OWNER = 'instance_owner',
  USER = 'user',
}

/**
 * === Role Definitions & Routing (Project Watan) ===
 * DEVELOPER
 *   - Platform owner/developer (you).
 *   - Default admin for the whole platform.
 *   - Route namespace: /dev (e.g., /dev/dashboard, /dev/tools)
 *
 * INSTANCE_OWNER
 *   - Tenant (subdomain owner).
 *   - Manages store settings, products, prices, currencies, payouts...
 *   - Route namespace: /admin (e.g., /admin/products, /admin/currencies)
 *
 * USER
 *   - End customer.
 *   - Uses the tenant-facing UI to browse/buy, view wallet, request payout.
 *
 * Notes:
 * - Removed roles: ADMIN, DISTRIBUTOR (mapped to INSTANCE_OWNER).
 * - إذا احتجت صلاحيات مدير عام للمنصة استخدم DEVELOPER.
 * - الرجاء الرجوع لهذا التعليق عند التعامل مع الأدوار ومساراتها.
 */
