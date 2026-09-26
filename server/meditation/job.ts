import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from 'dotenv';
import type { Brief, MadeSession, MakingStatus, NarratorId } from '../../src/meditation/types';
import { duration, renderBed } from './audio';
import { assemble, decode, encodeNarration, envelopeOf, quietCut, RATE, sectionGain, trimmed, type Piece } from './pcm';
import { phraseTimes, sectionsOf } from './sections';
import { narrators } from './narrators';
import { layout, timing } from './plan';
import { pool, recordSection } from './voice';
import { writeScript, type Script } from './writer';

// Making a meditation on the development server: write → (wait for a voice) →
// record → mix. Progress lives on disk as well as in memory, so the app can follow
// it and a reload of the server can't lose a finished session. Keys stay in .env.local.
config({ path: '.env.local', quiet: true });

const ROOT = join(process.cwd(), '.cache', 'meditation');
const SESSIONS = join(ROOT, 'sessions'), TAKES = join(ROOT, 'takes');
const SEED = 4242;                       // one seed, so a narrator sounds like themselves from phrase to phrase
const live = new Map<string, MakingStatus>();
const waiting = new Map<string, (voice: NarratorId) => void>();

export const sessionDir = (id: string) => join(SESSIONS, id);
export const validId = (id: unknown): id is string => typeof id === 'string' && /^m[a-z0-9]{6,24}$/.test(id);
const exists = (file: string) => access(file).then(() => true, () => false);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Written whole, then renamed into place, so a poll never reads half a file.
let writes = 0;
async function save(status: MakingStatus) {
  live.set(status.id, status);
  const file = join(sessionDir(status.id), 'status.json'), temp = `${file}.${process.pid}.${writes++}`;
  try { await writeFile(temp, JSON.stringify(status)); await rename(temp, file); } catch {}
}

export function missingKeys() {
  return [!process.env.ELEVENLABS_API_KEY && 'ELEVENLABS_API_KEY', !process.env.KOKORO_OPENAI_API_KEY && 'KOKORO_OPENAI_API_KEY'].filter(Boolean) as string[];
}

// Starts writing at once. Without a voice in the brief, recording waits for
// continueMaking(id, voice) — the first run writes while the voice is chosen.
export function startMaking(brief: Brief) {
  const id = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const voice = brief.voiceId ? Promise.resolve(brief.voiceId) : new Promise<NarratorId>(resolve => waiting.set(id, resolve));
  const done = make(id, brief, voice);
  return { id, done };
}

export async function continueMaking(id: string, voice: NarratorId) {
  const resolve = waiting.get(id);
  if (resolve) { waiting.delete(id); resolve(voice); return true; }
  // The server was reloaded after the script was written: pick it up from disk.
  const status = await makingStatus(id);
  if (!status || status.stage === 'failed') return false;
  // Already recording (or done): never record the same meditation twice.
  if (status.stage === 'recording' || status.stage === 'mixing' || status.stage === 'ready') return true;
  const dir = sessionDir(id);
  const started = JSON.parse(await readFile(join(dir, 'brief.json'), 'utf8').catch(() => '{}')) as Brief;
  if (started.voiceId) return true;
  for (let i = 0; i < 90 && !(await exists(join(dir, 'script.json'))); i++) await sleep(1000);
  if (!(await exists(join(dir, 'script.json')))) return false;
  const brief = JSON.parse(await readFile(join(dir, 'brief.json'), 'utf8')) as Brief;
  const script = JSON.parse(await readFile(join(dir, 'script.json'), 'utf8')) as Script;
  void produce(id, { ...brief, voiceId: voice }, script);
  return true;
}

// Re-mixes a finished or stuck session from its script and cached takes (no new
// writing, and recording costs nothing when the words are unchanged).
export async function remake(id: string) {
  const dir = sessionDir(id);
  const brief = JSON.parse(await readFile(join(dir, 'brief.json'), 'utf8')) as Brief;
  const script = JSON.parse(await readFile(join(dir, 'script.json'), 'utf8')) as Script;
  return produce(id, brief, script);
}

function timer(id: string) {
  const started = Date.now();
  return (what: string) => console.log(`[meditation ${id}] ${what} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
}

async function make(id: string, brief: Brief, voice: Promise<NarratorId>): Promise<MakingStatus> {
  const dir = sessionDir(id);
  const log = timer(id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'brief.json'), JSON.stringify(brief, null, 2));
  let script: Script;
  try {
    await save({ id, stage: 'writing' });
    script = await writeScript(brief, process.env.KOKORO_OPENAI_API_KEY ?? '', process.env.KOKORO_OPENAI_MODEL || 'gpt-5.5');
    await writeFile(join(dir, 'script.json'), JSON.stringify(script, null, 2));
    log(`script: ${script.phrases.length} phrases, ${script.phrases.reduce((n, p) => n + p.text.split(/\s+/).length, 0)} words`);
  } catch (error) {
    return fail(id, error, log);
  }
  if (!brief.voiceId) await save({ id, stage: 'written' });
  const voiceId = await voice;
  const withVoice = { ...brief, voiceId };
  await writeFile(join(dir, 'brief.json'), JSON.stringify(withVoice, null, 2));
  return produce(id, withVoice, script);
}

async function produce(id: string, brief: Brief, script: Script): Promise<MakingStatus> {
  const dir = sessionDir(id);
  const log = timer(id);
  try {
    const narrator = narrators[brief.voiceId ?? 'brittney'];
    // Whoever records it, the brief on disk says so (a remake must use the same voice).
    await writeFile(join(dir, 'brief.json'), JSON.stringify({ ...brief, voiceId: narrator.id }, null, 2));
    // Whole passages, one take each, cut back into phrases at the quiet between
    // sentences (sections.ts, pcm.ts): an even voice, and every pause still exact.
    const sections = sectionsOf(script.phrases);
    const total = sections.length;
    let recorded = 0;
    await save({ id, stage: 'recording', done: 0, total });
    const takes = await pool(sections, 6, async section => {
      const take = await recordSection(section.text, narrator, SEED, process.env.ELEVENLABS_API_KEY ?? '', TAKES);
      recorded++;
      void save({ id, stage: 'recording', done: recorded, total });
      return take;
    });
    log(`recorded ${narrator.name}: ${total} takes`);

    await save({ id, stage: 'mixing', done: total, total });
    const pieces: Piece[] = new Array(script.phrases.length);
    for (let k = 0; k < sections.length; k++) {
      const section = sections[k], take = takes[k];
      const pcm = await decode(take.file, narrator.tempo);
      const seconds = pcm.length / RATE;
      const times = phraseTimes(section, take.starts, take.ends).map(t => ({ start: t.start / narrator.tempo, end: t.end / narrator.tempo }));
      const bounds = [Math.max(0, times[0].start - 0.1)];
      for (let j = 0; j < times.length - 1; j++) bounds.push(quietCut(pcm, times[j].end, times[j + 1].start));
      bounds.push(Math.min(seconds, times[times.length - 1].end + 0.6));
      const gain = sectionGain(pcm);
      section.phrases.forEach((index, j) => {
        const edge = trimmed(pcm, bounds[j], Math.max(bounds[j] + 0.05, bounds[j + 1]));
        pieces[index] = { pcm, from: edge.from, to: edge.to, gain };
      });
    }
    const plan = timing(brief.minutes);
    const placed = layout(script.phrases.map((p, i) => ({ ...p, duration: pieces[i].to - pieces[i].from })), plan);
    const pauses = placed.timeline.map((segment, i) => (i < placed.timeline.length - 1 ? placed.timeline[i + 1].start - segment.end : 0));
    const narration = assemble(pieces, pauses, plan.intro, plan.outro);
    const voiceFile = join(dir, 'voice.mp3');
    await encodeNarration(narration, join(dir, 'voice.wav'), voiceFile);
    const length = narration.length / RATE;
    const envelope = envelopeOf(narration, 20);
    // Longer than the voice's three-minute bed: a seamless bed of the right length.
    const bed = `assets/voices/${narrator.id}/music.mp3`;
    const long = length > (await duration(bed)) - 4;
    if (long) await renderBed(bed, length, join(dir, 'music.mp3'));
    for (const name of await readdir(dir)) if (name.endsWith('.wav')) await rm(join(dir, name), { force: true });

    const session: MadeSession = {
      id, title: script.title, description: script.description, minutes: brief.minutes, voiceId: narrator.id,
      duration: length, timeline: placed.timeline, envelope, envelopeRate: 20, voicePath: `/api/meditation-audio?id=${id}&v=${Date.now().toString(36)}`,
      ...(long ? { musicPath: `/api/meditation-audio?id=${id}&stem=music&v=${Date.now().toString(36)}` } : {}),
    };
    await writeFile(join(dir, 'session.json'), JSON.stringify(session));
    const status: MakingStatus = { id, stage: 'ready', session };
    await save(status);
    log(`ready: ${length.toFixed(1)}s, pauses ×${placed.scale.toFixed(2)}`);
    return status;
  } catch (error) {
    return fail(id, error, log);
  }
}

async function fail(id: string, error: unknown, log: (what: string) => void): Promise<MakingStatus> {
  const status: MakingStatus = { id, stage: 'failed', error: error instanceof Error ? error.message : 'Making failed.' };
  await save(status);
  log(`failed: ${status.error}`);
  return status;
}

export async function makingStatus(id: string): Promise<MakingStatus | null> {
  if (!validId(id)) return null;
  const known = live.get(id);
  if (known) return known;
  try { return JSON.parse(await readFile(join(sessionDir(id), 'status.json'), 'utf8')) as MakingStatus; } catch { return null; }
}

// The same script in another narrator's voice, as a new session.
export async function revoice(id: string, voiceId: NarratorId) {
  const from = sessionDir(id);
  const brief = JSON.parse(await readFile(join(from, 'brief.json'), 'utf8')) as Brief;
  const script = JSON.parse(await readFile(join(from, 'script.json'), 'utf8')) as Script;
  const next = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await mkdir(sessionDir(next), { recursive: true });
  await writeFile(join(sessionDir(next), 'script.json'), JSON.stringify(script, null, 2));
  return { id: next, done: produce(next, { ...brief, voiceId }, script) };
}

// The demo's safety net: the founder session, made ahead of time in each voice.
type Golden = Partial<Record<NarratorId, string>>;
async function readGolden(): Promise<Golden> {
  try {
    const raw = JSON.parse(await readFile(join(ROOT, 'golden.json'), 'utf8')) as Golden & { id?: string };
    return raw.id && !raw.brittney ? { brittney: raw.id } : raw;
  } catch { return {}; }
}

export async function goldenStatus(voiceId?: NarratorId): Promise<MakingStatus | null> {
  const golden = await readGolden();
  const id = (voiceId && golden[voiceId]) || golden.brittney;
  if (!id) return null;
  const status = await makingStatus(id);
  return status?.stage === 'ready' ? status : null;
}

export async function markGolden(id: string, voiceId: NarratorId) {
  await mkdir(ROOT, { recursive: true });
  const golden = await readGolden();
  delete (golden as { id?: string }).id;
  await writeFile(join(ROOT, 'golden.json'), JSON.stringify({ ...golden, [voiceId]: id }, null, 2));
}
