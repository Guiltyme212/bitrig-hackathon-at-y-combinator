import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Narrator } from './narrators';

// Records one phrase with ElevenLabs Eleven v3, the model behind every approved
// listening-room performance. Each phrase is recorded on its own so that the
// silence after it is exact; takes are cached, so a retry or a remake of the
// same words costs nothing.

const MODEL = 'eleven_v3';
const SETTINGS = { stability: 0.5 };   // v3 "Natural"

export async function recordPhrase(text: string, narrator: Narrator, seed: number, key: string, cacheDir: string): Promise<string> {
  const id = createHash('sha1').update(`${narrator.elevenLabsId}|${MODEL}|${JSON.stringify(SETTINGS)}|${seed}|${text}`).digest('hex');
  const file = join(cacheDir, `${id}.mp3`);
  try { if ((await readFile(file)).length > 800) return file; } catch {}

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${narrator.elevenLabsId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
        body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS, seed }),
        signal: AbortSignal.timeout(20_000),      // a phrase takes 1–3 s; a stuck one is retried
      });
      if (response.status === 429 || response.status >= 500) throw new Error(`The voice was busy (${response.status}).`);
      if (!response.ok) throw Object.assign(new Error(`The voice refused this line (${response.status}).`), { final: true });
      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.length < 800) throw new Error('The voice came back empty.');
      await mkdir(cacheDir, { recursive: true });
      await writeFile(file, audio);
      if (Date.now() - started > 8000) console.log(`[voice] a phrase took ${((Date.now() - started) / 1000).toFixed(1)}s (attempt ${attempt + 1})`);
      return file;
    } catch (error) {
      lastError = error;
      if ((error as { final?: boolean }).final) break;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The voice failed.');
}

// Records one whole section (several phrases) in a single Eleven v3 take, with the
// voice service's character timings, so the take can be cut back into phrases at the
// quiet between sentences. One take per passage keeps a narrator's tone and level
// even; a take per phrase made them uneven (Dan: Brad, 26 September). Cached.
export type Take = { file: string; starts: number[]; ends: number[] };
export async function recordSection(text: string, narrator: Narrator, seed: number, key: string, cacheDir: string): Promise<Take> {
  const id = createHash('sha1').update(`${narrator.elevenLabsId}|${MODEL}|${JSON.stringify(SETTINGS)}|${seed}|ts|${text}`).digest('hex');
  const file = join(cacheDir, `${id}.mp3`), timing = join(cacheDir, `${id}.json`);
  try {
    if ((await readFile(file)).length > 800) {
      const t = JSON.parse(await readFile(timing, 'utf8')) as { starts: number[]; ends: number[] };
      if (t.starts?.length === text.length) return { file, starts: t.starts, ends: t.ends };
    }
  } catch {}

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${narrator.elevenLabsId}/with-timestamps?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
        body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS, seed }),
        signal: AbortSignal.timeout(60_000),
      });
      if (response.status === 429 || response.status >= 500) throw new Error(`The voice was busy (${response.status}).`);
      if (!response.ok) throw Object.assign(new Error(`The voice refused this passage (${response.status}).`), { final: true });
      const body = await response.json() as { audio_base64?: string; alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] } };
      const audio = Buffer.from(body.audio_base64 ?? '', 'base64');
      if (audio.length < 800) throw new Error('The voice came back empty.');
      const chars = body.alignment?.characters ?? [];
      const starts = body.alignment?.character_start_times_seconds ?? [], ends = body.alignment?.character_end_times_seconds ?? [];
      // The timings map one to one onto the text; if they don't, spread the text evenly.
      const aligned = starts.length === text.length && ends.length === text.length && chars.length === text.length;
      const last = ends[ends.length - 1] ?? 0;
      const even = (i: number) => (last > 0 ? (last * i) / text.length : 0);
      const take = aligned ? { starts, ends } : { starts: Array.from(text, (_, i) => even(i)), ends: Array.from(text, (_, i) => even(i + 1)) };
      await mkdir(cacheDir, { recursive: true });
      await writeFile(file, audio);
      await writeFile(timing, JSON.stringify(take));
      return { file, ...take };
    } catch (error) {
      lastError = error;
      if ((error as { final?: boolean }).final) break;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The voice failed.');
}

// Runs `work` over every item with at most `limit` at a time, in order of the results.
export async function pool<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i], i);
    }
  });
  await Promise.all(lanes);
  return results;
}
