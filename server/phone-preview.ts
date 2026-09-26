import { networkInterfaces } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import QRCode from 'qrcode';

async function main() {
const interfaces = networkInterfaces();
const candidates = Object.entries(interfaces).sort(([a], [b]) => {
  const rank = (name: string) => name === 'en0' ? 0 : name.startsWith('en') ? 1 : 2;
  return rank(a) - rank(b);
});
const address = candidates.flatMap(([, values]) => values || [])
  .find(value => value.family === 'IPv4' && !value.internal)?.address;
if (!address) throw new Error('No LAN IPv4 address is available. Connect this Mac to Wi-Fi.');
const origin = `http://${address}:8081`;
const response = await fetch(origin, { headers: { 'expo-platform': 'ios', accept: 'application/expo+json' }, signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error('The Expo development server is not reachable on the LAN.');
const manifest = await response.json() as { launchAsset?: { url?: string }; extra?: { expoClient?: { slug?: string; hostUri?: string } } };
if (manifest.extra?.expoClient?.slug !== 'kokoro-orb-onboarding' || !manifest.launchAsset?.url) {
  throw new Error('Port 8081 did not return the isolated orb project’s Expo manifest.');
}
const expoUrl = `exp://${address}:8081`;
await mkdir('qa', { recursive: true });
await QRCode.toFile('qa/expo-go-qr.png', expoUrl, { width: 420, margin: 3, errorCorrectionLevel: 'M' });
await writeFile('qa/phone-preview.json', JSON.stringify({ expoUrl, webUrl: origin, verifiedAt: new Date().toISOString(), launchAsset: manifest.launchAsset.url }, null, 2));
console.log(`Expo Go: ${expoUrl}\nWebsite: ${origin}\nQR: qa/expo-go-qr.png`);

}
main().catch(error => { console.error(error instanceof Error ? error.message : "Phone preview failed."); process.exitCode = 1; });
