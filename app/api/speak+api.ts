import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from 'dotenv';
import { isNarrator, narrators } from '../../server/meditation/narrators';

// Kokoro speaks in the voice the person chose at the start (Dan, 26 September: pick
// the orb and voice first), Brittney until then: the approved roster from
// docs/v5/AUDIO_GUIDE.md (server/meditation/narrators.ts), conversational settings.
// Development server only: the key stays here, each line is generated once and
// cached on disk, and a tunnel visitor can't run up the bill.
config({ path: '.env.local', quiet: true });

const MODEL = 'eleven_multilingual_v2';
const BASE = { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true };
// Brittney's line is unchanged, so the lines already cached in her voice stay valid.
const SPEED: Record<string, number> = { brittney: 0.96, natasha: 1, brad: 0.94, jerry: 1 };
const CACHE = join(process.cwd(), '.cache', 'speech');
const LIMIT = 400;                      // new lines generated per hour
const made: number[] = [];

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const text = (params.get('text') ?? '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 180) return Response.json({ error: 'Say something shorter.' }, { status: 400 });
  const who = params.get('voice') ?? 'brittney';
  const narrator = isNarrator(who) ? narrators[who] : narrators.brittney;
  const VOICE = narrator.elevenLabsId;
  const SETTINGS = { ...BASE, speed: SPEED[narrator.id] ?? 1 };
  const id = createHash('sha1').update(`${VOICE}|${MODEL}|${JSON.stringify(SETTINGS)}|${text}`).digest('hex');
  const file = join(CACHE, `${id}.mp3`);
  try {
    return new Response(await readFile(file), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
  } catch {}

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: 'No voice on this server.' }, { status: 503 });
  const now = Date.now();
  while (made.length && now - made[0] > 3_600_000) made.shift();
  if (made.length >= LIMIT) return Response.json({ error: 'Resting for a bit.' }, { status: 429 });
  made.push(now);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return Response.json({ error: `The voice didn't answer (${response.status}).` }, { status: 502 });
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 800) return Response.json({ error: 'The voice came back empty.' }, { status: 502 });
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, audio);
  return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
