// Only RevenueCat's active entitlement grants access. Product ownership alone does not.
export const ENTITLEMENT = 'kokoro_pro';
type AccessInfo = { entitlements: { active: Record<string, { isActive: boolean; periodType: string; isSandbox: boolean }> } };
export function accessFrom(info: AccessInfo) {
  const entitlement = info.entitlements.active[ENTITLEMENT];
  return {
    hasPro: entitlement?.isActive === true,
    isTrial: entitlement?.isActive === true && entitlement.periodType.toLowerCase() === 'trial',
    isSandbox: entitlement?.isActive === true && entitlement.isSandbox,
  };
}
export function configurationProblem(platform: string, expoGo: boolean, debug: boolean, key: string): string | null {
  if (platform !== 'ios' && platform !== 'android') return 'Purchases are available in the native Kokoro app.';
  if (expoGo) return 'Open the Kokoro development build to test purchases. Expo Go only provides mock purchases.';
  if (!key) return 'Purchases are not configured in this build.';
  if (key.startsWith('test_') && !debug) return 'Test Store purchases are disabled in release builds.';
  if (!/^(test_|appl_|goog_)/.test(key)) return 'A public RevenueCat SDK key is required.';
  return null;
}
