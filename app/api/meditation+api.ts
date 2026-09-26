import type { Brief, Outcome } from '@/meditation/types';
import { continueMaking, goldenStatus, makingStatus, missingKeys, startMaking, validId } from '../../server/meditation/job';
import { isNarrator } from '../../server/meditation/narrators';

// The meditation engine, on the development server only (keys stay in .env.local):
//   POST { brief }            → { id }     starts writing (and recording, if the brief has a voice)
//   POST { id, voiceId }      → { ok }     the voice was chosen: record and mix
//   GET ?id=…                 → status     writing | written | recording | mixing | ready | failed
//   GET ?golden=1             → status     the pre-made founder session (demo safety net)
// Rate-limited, because the Expo tunnel is public.

const LIMIT = 80;                       // new meditations per hour
const made: number[] = [];
const OUTCOMES: Outcome[] = ['settle', 'clarity', 'support', 'sleep', 'lift'];
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function readBrief(raw: Record<string, unknown>): Brief | null {
  const situation = text(raw.situation, 600);
  if (!situation) return null;
  const minutes = [1, 3, 5, 10].includes(Number(raw.minutes)) ? Number(raw.minutes) : 3;
  const outcome = OUTCOMES.includes(raw.outcome as Outcome) ? (raw.outcome as Outcome) : 'settle';
  const words = Array.isArray(raw.words) ? raw.words.map(w => text(w, 160)).filter(Boolean).slice(0, 3) : [];
  return {
    name: text(raw.name, 40) || undefined, situation, words, outcome, minutes,
    feeling: text(raw.feeling, 80) || undefined, next: text(raw.next, 160) || undefined, title: text(raw.title, 60) || undefined,
    voiceId: isNarrator(raw.voiceId) ? raw.voiceId : undefined,
  };
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: 'Send JSON.' }, { status: 400 }); }

  if (body.id !== undefined) {
    if (!validId(body.id) || !isNarrator(body.voiceId)) return Response.json({ error: 'Which meditation, and whose voice?' }, { status: 400 });
    const ok = await continueMaking(body.id, body.voiceId);
    return ok ? Response.json({ ok: true }) : Response.json({ error: 'That meditation can’t continue.' }, { status: 409 });
  }

  const missing = missingKeys();
  if (missing.length) return Response.json({ error: 'The meditation engine has no keys on this server.' }, { status: 503 });
  const brief = readBrief((body.brief ?? {}) as Record<string, unknown>);
  if (!brief) return Response.json({ error: 'Tell me what it should be about.' }, { status: 400 });
  const now = Date.now();
  while (made.length && now - made[0] > 3_600_000) made.shift();
  if (made.length >= LIMIT) return Response.json({ error: 'Resting for a bit.' }, { status: 429 });
  made.push(now);
  const { id } = startMaking(brief);
  return Response.json({ id });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const voice = params.get('voice');
  const status = params.get('golden') ? await goldenStatus(isNarrator(voice) ? voice : undefined) : await makingStatus(params.get('id') ?? '');
  return status ? Response.json(status, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'Not found.' }, { status: 404 });
}
