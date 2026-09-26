import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Serves a finished meditation's narration (or, with stem=music, its long bed),
// with byte ranges so the player can seek.
// Development server only; ids are checked so no other file can be asked for.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') ?? '';
  const file = params.get('stem') === 'music' ? 'music.mp3' : 'voice.mp3';
  if (!/^m[a-z0-9]{6,24}$/.test(id)) return Response.json({ error: 'Not found.' }, { status: 404 });
  let audio: Buffer;
  try { audio = await readFile(join(process.cwd(), '.cache', 'meditation', 'sessions', id, file)); }
  catch { return Response.json({ error: 'Not found.' }, { status: 404 }); }

  const headers = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (!range) return new Response(new Uint8Array(audio), { headers: { ...headers, 'Content-Length': String(audio.length) } });
  const size = audio.length;
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(new Uint8Array(audio.subarray(start, end + 1)), {
    status: 206,
    headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
  });
}
