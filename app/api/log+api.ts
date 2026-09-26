import { appendFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// What the app tells the development server about its own steps (listening,
// transcribing), so a failure on someone's phone can be read here afterwards:
// .cache/client-log.jsonl. Development server only; never words they said, only
// what happened. Rate-limited and size-capped, because the tunnel is public.
const FILE = join(process.cwd(), '.cache', 'client-log.jsonl');
const LIMIT = 600;                      // events per hour
const seen: number[] = [];

export async function POST(request: Request) {
  const now = Date.now();
  while (seen.length && now - seen[0] > 3_600_000) seen.shift();
  if (seen.length >= LIMIT) return Response.json({ ok: false }, { status: 429 });
  seen.push(now);
  let body: Record<string, unknown> = {};
  try { body = await request.json() as Record<string, unknown>; } catch {}
  const event = typeof body.event === 'string' ? body.event.slice(0, 60) : 'unknown';
  const text = body.detail && typeof body.detail === 'object' ? JSON.stringify(body.detail) : undefined;
  let detail: unknown = undefined;
  if (text) { try { detail = text.length <= 600 ? JSON.parse(text) : text.slice(0, 600); } catch { detail = text.slice(0, 600); } }
  try {
    await mkdir(join(process.cwd(), '.cache'), { recursive: true });
    const size = await stat(FILE).then(s => s.size, () => 0);
    if (size < 5_000_000) await appendFile(FILE, `${JSON.stringify({ at: new Date(now).toISOString(), event, detail })}\n`);
  } catch {}
  return Response.json({ ok: true });
}
