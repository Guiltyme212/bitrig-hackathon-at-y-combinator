import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

// Server-side verification only. Never import this into app/ or src/.
const id = process.argv[2];
if (!id) throw new Error('Usage: npx tsx scripts/revenuecat-verify.ts <RevenueCat app user ID>');
const env = parse(readFileSync(resolve('.env.revenuecat-admin.local')));
const key = env.REVENUECAT_SECRET_API_KEY;
if (!key?.startsWith('sk_')) throw new Error('A server-only RevenueCat secret key is required.');
async function main() {
const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, {
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
});
const data = await response.json();
if (!response.ok) throw new Error(`RevenueCat verification failed (HTTP ${response.status}).`);
const subscriber = data.subscriber;
const entitlement = subscriber.entitlements.kokoro_pro;
const subscription = entitlement ? subscriber.subscriptions[entitlement.product_identifier] : undefined;
const active = !!entitlement && (!entitlement.expires_date || Date.parse(entitlement.expires_date) > Date.now());
console.log(JSON.stringify({
  verifiedAt: data.request_date,
  entitlement: 'kokoro_pro', active,
  product: entitlement?.product_identifier ?? null,
  expiresAt: entitlement?.expires_date ?? null,
  sandbox: subscription?.is_sandbox ?? null,
  store: subscription?.store ?? null,
}, null, 2));

}
void main().catch(() => { console.error("RevenueCat verification failed. Check the API key and customer ID."); process.exitCode = 1; });
