import { config } from 'dotenv';
import { mkdir, writeFile, stat } from 'node:fs/promises';
config({ path: '.env.local', quiet: true });

async function main() {
  const target = 'assets/audio/arrival.mp3';
  try { if ((await stat(target)).size > 1000) { console.log('Existing generated music preserved.'); return; } } catch {}
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('ElevenLabs credential is missing.');
  const input = {
    prompt: 'A quietly beautiful instrumental soundscape for an intimate meditation onboarding. 90 seconds. Slow spacious felt piano notes, warm rounded glass marimba, airy soft synth harmonics and subtle evolving chords. Starts with two seconds of near silence and a soft gentle swell. Harmonically develops every 12 seconds, a feeling of coming home and possibility, delicate suspended notes and deep warmth. No static drone, no repetitive high tone, no percussion beat, no vocals, no breathing or water sounds, no hiss, no sharp bell attack, no cinematic tension. Understated modern luxury, soothing and contemplative. Smooth ending into silence.',
    music_length_ms: 90000, model_id: 'music_v2', force_instrumental: true,
  };
  const response = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY }, body: JSON.stringify(input),
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok) throw new Error(`Music generation returned HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000) throw new Error('Music response was unexpectedly empty.');
  await mkdir('assets/audio', { recursive: true });
  await writeFile(target, bytes);
  await writeFile('assets/audio/provenance.json', JSON.stringify({ provider: 'ElevenLabs', input, generatedAt: new Date().toISOString(), bytes: bytes.length }, null, 2));
  console.log(`Generated music saved (${bytes.length} bytes).`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Music generation failed.'); process.exitCode = 1; });
