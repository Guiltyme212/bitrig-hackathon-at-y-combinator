import { config as loadEnv } from 'dotenv';
import { config, higgsfield } from '@higgsfield/client/v2';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { completedVideo, failedStatuses } from './result';

// Server-only example. Never import this module from the Expo application.
loadEnv({ path: '.env.local', quiet: true });
const model = 'bytedance/seedance-2.5/text-to-video';
const requestedVariant = process.argv.find(value => value.startsWith('--variant='))?.split('=')[1];
const variantPrompts: Record<string, string> = {
  prism: 'A fluid, softly irregular glass orb, like thick optical liquid frozen in slow motion. Sculpted flowing folds bend light into thin, vivid spectral bands of cyan, emerald, warm amber and red, concentrated on the folds and rim. Its center is transparent dark glass. Holographic chromatic dispersion with realistic depth, never a glowing neon ball. Slowly and delicately deforming surface, gentle organic silhouette, mesmerizing but calm.',
  tide: 'A crystal-clear water orb with a softly asymmetric organic silhouette, like a large drop of water suspended in zero gravity. A wide gentle folded wave rolls through its thick transparent shell. Cool silver and ice-blue reflections curve around the water, small pale violet edge highlights, deep optical refraction. The material is perfectly clear, dark in the center, fluid and sculptural. Very slow, relaxing surface movement.',
  pearl: 'An opalescent liquid glass orb, translucent milky crystal, luminous pearl white at the curved edges with subtle pink, lavender and champagne iridescence. A smoky transparent center creates real depth. Broad silky liquid folds roll slowly over its softly imperfect spherical surface. Premium polished blown glass, pearly transmission and realistic subtle spectral dispersion, elegant rather than a bright glow.',
};
if (requestedVariant && !variantPrompts[requestedVariant]) throw new Error('Choose prism, tide or pearl.');
const name = requestedVariant || (process.argv.includes('--orb') ? 'orb' : 'sunset');
const destination = path.resolve('private', `higgsfield-${name}.json`);
const input = name === 'sunset' ? {
  prompt: 'A cinematic scene at sunset', duration: 5, resolution: '720p', aspect_ratio: '16:9',
} : requestedVariant ? {
  prompt: `${variantPrompts[requestedVariant]} Locked camera, macro luxury CGI studio render. One orb only, centered, fully visible, occupying seventy percent of a square frame. Pure solid black background and empty black space on every side. No floor, no pedestal, no environment, no water ripples underneath, no particles, no light beams, no text, no logo. Only the glass shape moves. No camera movement or zoom. Eight-second continuous calm material study.`,
  duration: 8, resolution: '720p', aspect_ratio: '1:1', generate_audio: false,
} : {
  prompt: 'Locked-off macro studio camera. A single perfectly clear liquid glass orb floats centered against a completely pure black background. Occupies 65 percent of the square frame. Premium optical glass with a thick transparent shell, soft silver curved highlights, restrained blue-violet and rose chromatic refraction along the edges. Its liquid surface slowly and subtly deforms, like water suspended in zero gravity. The interior remains mostly transparent black, with curved luminous reflections. A continuous calm seamless cycle. No pedestal, no text, no particles, no logo, no camera movement, no scenery. Photorealistic luxury CGI, realistic transmission, caustics, depth and dispersion. The beginning and end match.',
  duration: 8, resolution: '720p', aspect_ratio: '1:1', generate_audio: false,
};

type RecordState = {
  status: string; model: string; input: typeof input; requestId?: string;
  videoUrl?: string; startedAt?: string; finishedAt?: string; verifiedAt?: string;
  errorType?: string;
};
async function save(record: RecordState) {
  await writeFile(destination, JSON.stringify(record, null, 2), { mode: 0o600 });
}
async function verifyAndOutput(record: RecordState) {
  const url = completedVideo(record.status, record.videoUrl);
  const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('video/')) {
    throw new Error('The result URL did not return a playable video response.');
  }
  record.verifiedAt = new Date().toISOString();
  await save(record);
  if (name !== 'sunset') {
    const download = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!download.ok) throw new Error('Could not download the generated orb.');
    await mkdir('assets/video', { recursive: true });
    await writeFile(`assets/video/${name}.mp4`, Buffer.from(await download.arrayBuffer()));
  }
  console.log(url);
}
async function main() {
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials) throw new Error('Credentials missing. Enter HF_CREDENTIALS locally in .env.local.');
  await mkdir('private', { recursive: true, mode: 0o700 });
  let record: RecordState | undefined;
  try { record = JSON.parse(await readFile(destination, 'utf8')); } catch {}
  if (record?.status === 'completed') { await verifyAndOutput(record); return; }
  if (record && failedStatuses.has(record.status)) {
    throw new Error(`Previous generation is ${record.status}. No new billable request was submitted.`);
  }
  if (record && ['submitted', 'unknown'].includes(record.status) && !record.requestId) {
    throw new Error('A request may exist without a saved ID. Resolve that request before submitting another.');
  }
  config({ credentials, maxRetries: 0 });
  try {
    if (!record?.requestId) {
      record = { status: 'submitted', model, input, startedAt: new Date().toISOString() };
      await save(record);
      // Capture the official SDK request ID before waiting, so interrupted runs
      // resume the same job and never silently buy a replacement generation.
      const response = await higgsfield.subscribe(model, { input, withPolling: false });
      record = { ...record, status: response.status, requestId: response.request_id, videoUrl: response.video?.url };
      await save(record);
    }
    const deadline = Date.now() + 3600000;
    while (record.status !== 'completed' && !failedStatuses.has(record.status)) {
      if (!record.requestId) throw new Error('The SDK did not return a request ID.');
      if (Date.now() > deadline) throw new Error('Polling timed out; the saved request can be resumed.');
      // Same status endpoint used by @higgsfield/client 0.2.6. Its built-in
      // poller omits canceled, so this loop also stops on cancellation.
      const statusResponse = await fetch(`https://api.higgsfield.ai/requests/${encodeURIComponent(record.requestId)}/status`, {
        headers: { Authorization: `Key ${credentials}` }, signal: AbortSignal.timeout(30000),
      });
      if (!statusResponse.ok) throw new Error('Status could not be retrieved; resume the saved request.');
      const status = await statusResponse.json() as { status: string; video?: { url?: string } };
      record = { ...record, status: status.status, videoUrl: status.video?.url };
      await save(record);
      if (record.status !== 'completed' && !failedStatuses.has(record.status)) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    record.finishedAt = new Date().toISOString();
    await save(record);
    await verifyAndOutput(record);
  } catch (error) {
    const kind = error instanceof Error ? error.constructor.name : 'UnknownError';
    if (record) await save({ ...record, status: record.status === 'submitted' ? 'unknown' : record.status, errorType: kind });
    console.error(`Higgsfield generation did not verify successfully (${kind}). The request record is preserved.`);
    process.exitCode = 1;
  }
}
main().catch(() => { console.error('Higgsfield setup did not verify. Check the local environment and saved request record.'); process.exitCode = 1; });
