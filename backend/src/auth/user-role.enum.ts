export enum UserRole {
  DEVELOPER = 'developer',
  /**
   * @deprecated سيُزال لاحقاً. استخدم ADMIN كمالك التينانت.
   */
  INSTANCE_OWNER = 'instance_owner',
  DISTRIBUTOR = 'distributor',
  USER = 'user',
  ADMIN = 'admin', // لو تحتاج دور إداري عام
}
