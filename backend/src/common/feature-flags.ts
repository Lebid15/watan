// Central place for feature flags (simple boolean toggles). Forward-only, no runtime admin UI yet.
// Phase 1: product image fallback flag (always true once deployed, but structured for future toggling)
const boolEnv = (v?: string) => !!v && /^(1|true|yes|on)$/i.test(v);
const billingDefault = process.env.NODE_ENV === 'production' ? false : true; // enable by default on non-prod
export const FEATURE_FLAGS = {
  productImageFallback: true,
  catalogLinking: true,
  externalApi: true,
  billingV1: boolEnv(process.env.FEATURE_BILLING_V1) ? true : billingDefault,
};

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return !!FEATURE_FLAGS[flag];
}

export function isBillingEnabledEnv(): boolean {
  return isFeatureEnabled('billingV1');
}
