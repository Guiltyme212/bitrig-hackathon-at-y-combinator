import { config } from 'dotenv';

// Turns what someone said to the orb into words, with ElevenLabs Scribe.
// Development server only: nothing is stored here, clips are capped in size,
// and a tunnel visitor can't run up the bill.
config({ path: '.env.local', quiet: true });

const LIMIT = 200;                       // clips per hour
const MAX_BYTES = 3 * 1024 * 1024;      // about three minutes of speech
const heard: number[] = [];

export async function POST(request: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: 'No listening on this server.' }, { status: 503 });
  const now = Date.now();
  while (heard.length && now - heard[0] > 3_600_000) heard.shift();
  if (heard.length >= LIMIT) return Response.json({ error: 'Resting for a bit.' }, { status: 429 });

  let clip: File | null = null;
  try {
    // The server's FormData (undici), not React Native's, which has no get().
    const form = await request.formData() as unknown as { get(name: string): unknown };
    const value = form.get('audio');
    clip = value instanceof File ? value : null;
  } catch {}
  if (!clip || clip.size < 1000) return Response.json({ error: 'Nothing to hear.' }, { status: 400 });
  if (clip.size > MAX_BYTES) return Response.json({ error: 'That was a long one. Try something shorter.' }, { status: 413 });
  heard.push(now);

  const body = new FormData();
  body.append('model_id', 'scribe_v1');
  body.append('tag_audio_events', 'false');
  body.append('file', clip, clip.name || 'speech.m4a');
  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST', headers: { 'xi-api-key': key }, body, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return Response.json({ error: `Listening failed (${response.status}).` }, { status: 502 });
  const result = await response.json() as { text?: string };
  const text = (result.text ?? '').replace(/\s+/g, ' ').trim();
  return Response.json({ text });
}
