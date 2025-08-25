// Central place for feature flags (simple boolean toggles). Forward-only, no runtime admin UI yet.
// Phase 1: product image fallback flag (always true once deployed, but structured for future toggling)
export const FEATURE_FLAGS = {
  productImageFallback: true,
};

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return !!FEATURE_FLAGS[flag];
}
