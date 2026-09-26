import type { ConfigContext, ExpoConfig } from 'expo/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The iPhone Duo native build (KOKORO_DUO=1) rotates, launches on black and has its own
// bundle id. Without the flag this returns app.json untouched, so Expo Go and the web
// demo are exactly as before.
export default ({ config }: ConfigContext): ExpoConfig => {
  // Only the public SDK config enters the app bundle; server .env.local stays private.
  const rcPath = join(__dirname, '.revenuecat.local.json');
  const rc = existsSync(rcPath) ? JSON.parse(readFileSync(rcPath, 'utf8')) : {};
  const key = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? rc.apiKey ?? '';
  if (key && !/^(test_|appl_|goog_)/.test(key)) throw new Error('RevenueCat requires a public SDK key, never a secret key.');
  config.extra = { ...config.extra, revenueCat: { apiKey: key, entitlement: 'kokoro_pro' } };
  if (process.env.KOKORO_DUO !== '1') return config as ExpoConfig;
  return {
    ...(config as ExpoConfig),
    orientation: 'default',
    ios: { ...config.ios, bundleIdentifier: 'com.kokoro.hackathon.duo' },
    plugins: [...(config.plugins ?? []), './plugins/withDuoNative'],
  };
};
