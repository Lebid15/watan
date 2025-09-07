export enum UserRole {
  DEVELOPER = 'developer',
  /**
   * @deprecated سيُزال لاحقاً. استخدم ADMIN كمالك التينانت.
   */
  INSTANCE_OWNER = 'instance_owner',
  DISTRIBUTOR = 'distributor',
  USER = 'user',
  ADMIN = 'admin', // لو تحتاج دور إداري عام
  MUHAMMED = 'muhammed', // دور خاص لمستخدم واحد لمسار مخصص
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
 * - Removed roles: ADMIN, DISTRIBUTOR (no longer used).
 * - إذا احتجت صلاحيات مدير عام للمنصة استخدم DEVELOPER.
 * - الرجاء الرجوع لهذا التعليق عند التعامل مع الأدوار ومساراتها.
 */