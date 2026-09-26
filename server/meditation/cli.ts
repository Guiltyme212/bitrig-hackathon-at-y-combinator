import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Brief, MakingStatus, NarratorId } from '../../src/meditation/types';
import { GENERATED_DUCK_FLOOR, speechRegions } from '../../src/meditation/mix';
import { renderMix } from './audio';
import { markGolden, missingKeys, remake, revoice, sessionDir, startMaking } from './job';

// Makes one meditation from the terminal, without the app:
//   npm run make:meditation                     the founder demo session (Brittney, 3 min)
//   npm run make:meditation -- brief.json       any brief
//   npm run make:meditation -- --remake <id>    re-mix a session from its script and cached takes
//   npm run make:meditation -- --revoice <id> natasha   the same script in another voice
// Flags: --golden keeps it as the demo's safety net; --check transcribes the result
// to catch delivery tags spoken aloud. Always renders review.mp3 (voice + the
// voice's approved bed, ducked like the player).

const founder: Brief = {
  name: 'Dan',
  situation: 'Just moved to San Francisco to build a startup. Money is running out, no investor has said yes yet, and they really want to get into Y Combinator. They go to events partly for the free food, and wonder whether they are doing any of this right.',
  words: ['am I even doing it right?', 'nobody wants to invest in me', 'I go to events for the free food'],
  feeling: 'pressure, with some doubt underneath',
  next: 'keep going with the YC application and the next investor conversations',
  outcome: 'clarity',
  minutes: 3,
  voiceId: 'brittney',
};

async function check(file: string, script: string) {
  const body = new FormData();
  body.append('model_id', 'scribe_v1');
  body.append('tag_audio_events', 'false');
  body.append('file', new Blob([await readFile(file)], { type: 'audio/mpeg' }), 'voice.mp3');
  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! }, body });
  const heard = ((await response.json()) as { text?: string }).text ?? '';
  const words = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
  const said = new Set(words(script));
  const spokenTags = ['warmly', 'gently', 'softly', 'calmly', 'smiling', 'exhales', 'whispers'].filter(t => words(heard).includes(t) && !said.has(t));
  console.log(`check: heard ${words(heard).length} words for ${words(script).length} written; tags spoken aloud: ${spokenTags.length ? spokenTags.join(', ') : 'none'}`);
}

async function main() {
  const missing = missingKeys();
  if (missing.length) throw new Error(`Missing in .env.local: ${missing.join(', ')}`);
  const args = process.argv.slice(2);
  const started = Date.now();
  let status: MakingStatus, brief: Brief, id: string;
  const again = args.indexOf('--remake'), other = args.indexOf('--revoice');
  if (other >= 0) {
    const made = await revoice(args[other + 1], args[other + 2] as NarratorId);
    id = made.id;
    brief = JSON.parse(await readFile(join(sessionDir(args[other + 1]), 'brief.json'), 'utf8'));
    console.log(`re-voicing ${args[other + 1]} as ${args[other + 2]} → ${id} …`);
    status = await made.done;
  } else if (again >= 0) {
    id = args[again + 1];
    brief = JSON.parse(await readFile(join(sessionDir(id), 'brief.json'), 'utf8'));
    console.log(`re-mixing ${id} …`);
    status = await remake(id);
  } else {
    const file = args.find(a => a.endsWith('.json'));
    brief = file ? JSON.parse(await readFile(file, 'utf8')) : founder;
    const made = startMaking(brief);
    id = made.id;
    console.log(`making ${id} …`);
    status = await made.done;
  }
  if (status.stage !== 'ready' || !status.session) throw new Error(status.error ?? 'Making failed.');
  const s = status.session;
  console.log(`ready in ${((Date.now() - started) / 1000).toFixed(1)}s: “${s.title}” — ${s.description}`);
  console.log(`${s.timeline.length} phrases, ${s.duration.toFixed(1)}s`);

  const provenance = JSON.parse(await readFile('assets/voices/provenance.json', 'utf8')) as { voices: { voice: string; session: { savedMix?: { voice: number; music: number } } }[] };
  const saved = provenance.voices.find(v => v.voice.toLowerCase() === s.voiceId)?.session.savedMix ?? { voice: 100, music: 100 };
  const review = join(sessionDir(id), 'review.mp3');
  await renderMix(join(sessionDir(id), 'voice.mp3'), s.musicPath ? join(sessionDir(id), 'music.mp3') : `assets/voices/${s.voiceId}/music.mp3`, speechRegions(s.timeline), s.duration,
    { voice: 0.8 * saved.voice / 100, music: 0.8 * saved.music / 100, floor: GENERATED_DUCK_FLOOR }, review);
  console.log(`review mix: ${review}`);
  if (args.includes('--check')) await check(join(sessionDir(id), 'voice.mp3'), s.timeline.map(t => t.text).join(' '));
  if (args.includes('--golden')) { await markGolden(id, s.voiceId); console.log(`kept as the demo’s golden session for ${s.voiceId}`); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
