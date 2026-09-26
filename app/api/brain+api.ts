import { signedUrl } from '../../server/brain/signed';

// Kokoro's brain: a signed address for one text conversation with the Kokoro Orb
// agent (ElevenLabs). Development server only; rate-limited because the tunnel is public.
const LIMIT = 150;                       // conversations per hour
const opened: number[] = [];

export async function GET() {
  const now = Date.now();
  while (opened.length && now - opened[0] > 3_600_000) opened.shift();
  if (opened.length >= LIMIT) return Response.json({ error: 'Resting for a bit.' }, { status: 429 });
  opened.push(now);
  try {
    const url = await signedUrl();
    return url ? Response.json({ url }, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'No brain on this server.' }, { status: 503 });
  } catch {
    return Response.json({ error: 'The brain couldn’t be reached.' }, { status: 502 });
  }
}
