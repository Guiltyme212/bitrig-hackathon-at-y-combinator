import { config as loadEnv } from 'dotenv';
import { config, higgsfield } from '@higgsfield/client/v2';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { completedVideo, failedStatuses } from './result';

// Server-only look-dev for the orb redesign (25 September): borderless luxury
// liquid glass, after Dan's two AmazingUI references. Dan's cap is $5–7 in
// total, so the planned spend is checked against a hard $7 limit before
// anything is submitted. Every job keeps its request ID in private/lookdev and
// is resumed, never re-bought.
loadEnv({ path: '.env.local', quiet: true });

const frame = 'Locked-off camera, no camera movement, no zoom. One sphere only, perfectly centered, about 55 percent of the square frame, fully visible with generous empty black space around it. Pure black background. No hard outline and no bright rim line around the sphere: its silhouette melts softly into the darkness through a gentle glow, as if very slightly out of focus at the edge. No floor, no pedestal, no reflection below, no particles, no dust, no text, no logo. Photorealistic luxury macro CGI, like a high-end jewelry film. Very slow, calm, hypnotic motion, the first and last frames match for a seamless loop.';

const looks: Record<string, string> = {
  obsidian: 'A sphere of dark liquid glass, almost black inside, like polished obsidian that is secretly liquid. Broad, slow twisting folds ripple through it like heavy silk turning in zero gravity. Deep sapphire and electric-blue light slides along the crests of the folds, with razor-thin prismatic fringes of red, amber, green and violet where the light bends at the fold edges. Glossy specular highlights glide across the surface.',
  halo: 'A luminous liquid glass sphere filled with light, seen through a lens that is very slightly out of focus. Soft vertical ribbons of light in electric blue, warm white and amber drift slowly around its curved surface as it turns, separated by deep dark gaps. Strong chromatic dispersion splits the ribbon edges into thin rainbow fringes. A soft blue halo glows around the sphere instead of an edge.',
  moonstone: 'A moonstone sphere of translucent milky liquid glass. A soft blue adularescent glow floats and shifts inside it, like moonlight moving under water, with pale silver, lavender and faint champagne-gold reflections. Its surface is a smooth sphere with gentle liquid undulations. Quiet, serene and precious, like a gemstone in a museum vitrine.',
  champagne: 'A sphere of smoked dark liquid glass holding warm light: slow rolling bands of champagne gold, amber and soft rose move inside it like candlelight through cognac. Thin spectral fringes shimmer where the bands bend. Warm specular highlights glide across the glossy surface, with a faint golden glow dissolving into the darkness around it.',
};

const kling = 'kling-video/v3.0/pro/text-to-video';
const seedance = 'bytedance/seedance-2.5/text-to-video';
// Worst-case list prices per second (open.higgsfield.ai, 25 September 2026):
// Kling 3.0 Pro $0.0924 (45% off until 1 October); Seedance 2.5 720p $0.4622 before its 30% offer.
const perSecond: Record<string, number> = { [kling]: 0.0924, [seedance]: 0.4622 };
const cap = 7;

type Job = { name: string; model: string; input: Record<string, unknown> };
const jobs: Job[] = [
  ...Object.entries(looks).map(([look, prompt]) => ({
    name: `kling-${look}`, model: kling,
    input: { prompt: `${prompt} ${frame}`, duration: 5, aspect_ratio: '1:1', sound: 'off', cfg_scale: 0.6, multi_shots: false },
  })),
  ...['obsidian', 'halo'].map(look => ({
    name: `seedance-${look}`, model: seedance,
    input: { prompt: `${looks[look]} ${frame}`, duration: 5, resolution: '720p', aspect_ratio: '1:1', generate_audio: false },
  })),
];

type RecordState = { status: string; model: string; input: Record<string, unknown>; requestId?: string; videoUrl?: string; startedAt?: string; finishedAt?: string; errorType?: string };
const records = path.resolve('private', 'lookdev');
const output = path.resolve('research', 'orb-lookdev');
const recordPath = (job: Job) => path.join(records, `${job.name}.json`);
const save = (job: Job, record: RecordState) => writeFile(recordPath(job), JSON.stringify(record, null, 2), { mode: 0o600 });

async function run(job: Job, credentials: string) {
  let record: RecordState | undefined;
  try { record = JSON.parse(await readFile(recordPath(job), 'utf8')); } catch {}
  if (record && failedStatuses.has(record.status)) { console.log(`${job.name}: ${record.status} earlier, not resubmitted`); return; }
  if (record && ['submitted', 'unknown'].includes(record.status) && !record.requestId) {
    console.log(`${job.name}: a request may exist without a saved ID; resolve it before resubmitting`); return;
  }
  try {
    if (!record?.requestId) {
      record = { status: 'submitted', model: job.model, input: job.input, startedAt: new Date().toISOString() };
      await save(job, record);
      const response = await higgsfield.subscribe(job.model, { input: job.input, withPolling: false });
      record = { ...record, status: response.status, requestId: response.request_id, videoUrl: response.video?.url };
      await save(job, record);
      console.log(`${job.name}: submitted`);
    }
    const deadline = Date.now() + 3600000;
    while (record.status !== 'completed' && !failedStatuses.has(record.status)) {
      if (Date.now() > deadline) throw new Error('Polling timed out; the saved request can be resumed.');
      await new Promise(resolve => setTimeout(resolve, 5000));
      const response = await fetch(`https://api.higgsfield.ai/requests/${encodeURIComponent(record.requestId!)}/status`, {
        headers: { Authorization: `Key ${credentials}` }, signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`Status request returned ${response.status}.`);
      const status = await response.json() as { status: string; video?: { url?: string } };
      record = { ...record, status: status.status, videoUrl: status.video?.url ?? record.videoUrl };
      await save(job, record);
    }
    if (failedStatuses.has(record.status)) { console.log(`${job.name}: ${record.status} (refunded by Higgsfield)`); return; }
    record.finishedAt = record.finishedAt ?? new Date().toISOString();
    await save(job, record);
    const download = await fetch(completedVideo(record.status, record.videoUrl), { signal: AbortSignal.timeout(120000) });
    if (!download.ok) throw new Error('Could not download the finished clip.');
    await writeFile(path.join(output, `${job.name}.mp4`), Buffer.from(await download.arrayBuffer()));
    console.log(`${job.name}: done`);
  } catch (error) {
    const kind = error instanceof Error ? `${error.constructor.name}: ${error.message}` : 'UnknownError';
    if (record) await save(job, { ...record, status: record.status === 'submitted' ? 'unknown' : record.status, errorType: kind });
    console.log(`${job.name}: did not finish (${kind}); the record is kept for resuming`);
  }
}

async function main() {
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials) throw new Error('Credentials missing. Enter HF_CREDENTIALS locally in .env.local.');
  const planned = jobs.reduce((sum, job) => sum + perSecond[job.model] * Number(job.input.duration), 0);
  console.log(`${jobs.length} clips, worst case $${planned.toFixed(2)} (cap $${cap})`);
  if (planned > cap) throw new Error('Planned spend is over the cap; nothing was submitted.');
  if (process.argv.includes('--dry')) { jobs.forEach(job => console.log(`${job.name}: ${job.model} ${JSON.stringify({ ...job.input, prompt: undefined })}`)); return; }
  await mkdir(records, { recursive: true, mode: 0o700 });
  await mkdir(output, { recursive: true });
  config({ credentials, maxRetries: 0 });
  // The API allows two concurrent requests on this account.
  const queue = [...jobs];
  await Promise.all([0, 1].map(async () => { for (let job = queue.shift(); job; job = queue.shift()) await run(job, credentials); }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Look-dev setup failed.'); process.exitCode = 1; });
