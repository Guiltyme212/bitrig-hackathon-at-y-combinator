import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

// A short-lived address for one conversation with the Kokoro Orb agent. The agent
// requires one (auth is on), so neither the key nor a usable agent id is in the app.
export async function signedUrl(): Promise<string | null> {
  const key = process.env.ELEVENLABS_API_KEY, agent = process.env.KOKORO_ORB_AGENT_ID;
  if (!key || !agent) return null;
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agent)}`, {
    headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const body = await response.json() as { signed_url?: string };
  return body.signed_url ?? null;
}
