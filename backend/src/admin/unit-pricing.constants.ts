// Centralized constants & dynamic decimal helpers (lazy precision config)
import { getDecimalRegex, getPriceDecimals } from '../config/pricing.config';
export const DECIMAL_DYNAMIC_REGEX = getDecimalRegex(); // legacy compatibility
export const PRICE_DECIMALS = getPriceDecimals();

// Error code/message constants (string values preserved)
export const ERR_MISSING_TENANT = 'Missing tenant context';
export const ERR_PACKAGE_NOT_FOUND = 'Package not found';
export const ERR_PRICE_GROUP_NOT_FOUND = 'Price group not found';
export const ERR_PRODUCT_NOT_FOUND = 'Product not found';
export const ERR_PACKAGE_NOT_UNIT = 'PACKAGE_NOT_UNIT';
export const ERR_PRODUCT_COUNTER_DISABLED = 'PRODUCT_COUNTER_DISABLED';
export const ERR_TENANT_MISMATCH = 'TENANT_MISMATCH';
// تمت إزالة unitPrice override لذا لم نعد نستخدم أخطاءه الخاصة
// تمت إزالة أخطاء unitPrice و baseUnitPrice بعد تبسيط النموذج.
export const ERR_UNIT_NAME_REQUIRED = 'unitName مطلوب';
export const ERR_RANGE_INVALID = 'RANGE_INVALID';
export const ERR_STEP_INVALID = 'STEP_INVALID';
export const ERR_SUPPORTS_COUNTER_REQUIRED = 'supportsCounter مطلوب';
export const ERR_PACKAGE_ID_REQUIRED = 'packageId مطلوب';
