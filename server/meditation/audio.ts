import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

// ffmpeg on this Mac (Homebrew). The development server may not inherit a shell PATH.
const bin = (name: string) => (existsSync(`/opt/homebrew/bin/${name}`) ? `/opt/homebrew/bin/${name}` : name);
const FFMPEG = bin('ffmpeg'), FFPROBE = bin('ffprobe');

function run(cmd: string, args: string[], binary = false): Promise<Buffer | string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 256 * 1024 * 1024, encoding: binary ? 'buffer' : 'utf8' }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${cmd.split('/').pop()} failed: ${String(stderr).slice(-400)}`));
      else resolve(stdout);
    });
  });
}

export async function duration(file: string) {
  const out = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const seconds = parseFloat(String(out));
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('A recording had no length.');
  return seconds;
}

// One recorded phrase, ready to be placed: the silence the voice service leaves at
// either end is trimmed (the pauses are ours to set), the narrator's tempo applied,
// low rumble removed, mono 44.1 kHz.
export async function preparePhrase(mp3: string, tempo: number, wav: string) {
  const trim = 'silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB';
  const filters = [trim, 'areverse', trim, 'areverse', ...(tempo !== 1 ? [`atempo=${tempo}`] : []), 'highpass=f=65'];
  await run(FFMPEG, ['-hide_banner', '-nostdin', '-y', '-i', mp3, '-af', filters.join(','), '-ar', '44100', '-ac', '1', wav]);
  return duration(wav);
}

// Every phrase at once, in one ffmpeg process (starting one per phrase cost more
// than the work itself): trimmed, the narrator's tempo applied, mono 16-bit WAVs,
// whose lengths follow from their size.
export async function preparePhrases(mp3s: string[], tempo: number, wavs: string[]) {
  const trim = 'silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB';
  const chain = [trim, 'areverse', trim, 'areverse', ...(tempo !== 1 ? [`atempo=${tempo}`] : []), 'highpass=f=65', 'aresample=44100', 'aformat=sample_fmts=s16:channel_layouts=mono'].join(',');
  const graph = mp3s.map((_, i) => `[${i}:a]${chain}[p${i}]`).join(';');
  const outputs = wavs.flatMap((wav, i) => ['-map', `[p${i}]`, '-c:a', 'pcm_s16le', wav]);
  await run(FFMPEG, ['-hide_banner', '-nostdin', '-y', ...mp3s.flatMap(f => ['-i', f]), '-filter_complex', graph, ...outputs]);
  return Promise.all(wavs.map(duration));
}

// The whole narration as one file: music-only intro, each phrase, the silence after
// it, the outro. Levelled like the listening room's approved mixes.
// How loud the speech itself is (dBFS RMS), read from the prepared 16-bit WAVs,
// so levelling doesn't have to process minutes of silence.
export async function speechLevel(wavs: string[]) {
  let sum = 0, count = 0;
  for (const wav of wavs) {
    const data = await readFile(wav);
    let at = 12;
    while (at + 8 <= data.length) {
      const id = data.toString('ascii', at, at + 4), size = data.readUInt32LE(at + 4);
      if (id === 'data') {
        for (let i = at + 8; i + 1 < Math.min(data.length, at + 8 + size); i += 2) { const v = data.readInt16LE(i) / 32768; sum += v * v; }
        count += Math.floor(size / 2);
        break;
      }
      at += 8 + size + (size % 2);
    }
  }
  return count ? 10 * Math.log10(sum / count + 1e-12) : -20;
}

export async function assembleNarration(parts: { file: string; pauseAfter: number }[], intro: number, outro: number, out: string, gainDb = 0) {
  const inputs = parts.flatMap(p => ['-i', p.file]);
  const chain: string[] = [];
  const labels: string[] = [];
  const gap = (label: string, seconds: number) => {
    chain.push(`anullsrc=r=44100:cl=mono,atrim=duration=${seconds.toFixed(3)}[${label}]`);
    labels.push(`[${label}]`);
  };
  gap('intro', intro);
  parts.forEach((p, i) => {
    chain.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=mono[p${i}]`);
    labels.push(`[p${i}]`);
    if (i < parts.length - 1) gap(`g${i}`, p.pauseAfter);
  });
  gap('outro', outro);
  // One gain to bring the speech to about −20 dB RMS (the approved mixes' level), and a
  // limiter for the odd peak. (loudnorm resamples to 192 kHz: minutes for a long session.)
  chain.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1,volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.89:level=0[out]`);
  await run(FFMPEG, ['-hide_banner', '-nostdin', '-y', ...inputs, '-filter_complex', chain.join(';'), '-map', '[out]', '-ar', '44100', '-ac', '1', '-b:a', '128k', out]);
  return duration(out);
}

// A bed as long as the session. The approved beds are three minutes and fade at
// both ends, so looping them would dip every three minutes: instead the steady
// middle is crossfaded into itself, with one fade in and one fade out.
export async function renderBed(music: string, length: number, out: string) {
  const bed = await duration(music);
  const from = 8, to = bed - 14, overlap = 12;
  const n = Math.max(2, Math.ceil((length - overlap) / (to - from - overlap)) + 1);
  const graph = [`[0:a]atrim=${from}:${to.toFixed(3)},asetpts=PTS-STARTPTS,asplit=${n}${Array.from({ length: n }, (_, i) => `[s${i}]`).join('')}`];
  let last = 's0';
  for (let i = 1; i < n; i++) { graph.push(`[${last}][s${i}]acrossfade=d=${overlap}:c1=tri:c2=tri[x${i}]`); last = `x${i}`; }
  graph.push(`[${last}]atrim=0:${length.toFixed(3)},afade=t=in:d=5,afade=t=out:st=${Math.max(0, length - 8).toFixed(3)}:d=8[out]`);
  await run(FFMPEG, ['-hide_banner', '-nostdin', '-y', '-i', music, '-filter_complex', graph.join(';'), '-map', '[out]', '-ar', '44100', '-b:a', '128k', out]);
}

// A listenable mix for review outside the app: the approved bed looped to length,
// ducked the way the player ducks it (`regions`, 1.5 s ramps), faded at the end.
export async function renderMix(voice: string, music: string, regions: { start: number; end: number }[], length: number,
  levels: { voice: number; music: number; floor: number }, out: string) {
  const ramp = 1.5;
  const gates = regions.map(({ start: a, end: b }) =>
    `if(between(t,${(a - ramp).toFixed(3)},${a.toFixed(3)}),(${a.toFixed(3)}-t)/${ramp},if(between(t,${a.toFixed(3)},${b.toFixed(3)}),0,if(between(t,${b.toFixed(3)},${(b + ramp).toFixed(3)}),(t-${b.toFixed(3)})/${ramp},1)))`);
  const gate = gates.reduce((acc, g) => (acc ? `min(${acc},${g})` : g), '') || '1';
  const duck = `${levels.music}*(${levels.floor}+${(1 - levels.floor).toFixed(3)}*(${gate}))`;
  const graph = [
    `[0:a]aformat=channel_layouts=stereo,volume=${levels.voice}[v]`,
    `[1:a]atrim=0:${length.toFixed(3)},volume='${duck}':eval=frame,afade=t=out:st=${Math.max(0, length - 6).toFixed(3)}:d=6[m]`,
    `[v][m]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.84:level=0[out]`,
  ].join(';');
  await run(FFMPEG, ['-hide_banner', '-nostdin', '-y', '-i', voice, '-i', music, '-filter_complex', graph, '-map', '[out]', '-ar', '44100', '-b:a', '160k', out]);
}

// The voice's loudness, 0..99 at `rate` per second, for the orb to breathe with
// (the same scale as the stand-in tracks' envelopes).
export async function loudness(file: string, rate = 20) {
  const pcm = await run(FFMPEG, ['-hide_banner', '-nostdin', '-i', file, '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], true) as Buffer;
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4));
  const size = Math.round(8000 / rate);
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += size) {
    let sum = 0;
    const end = Math.min(samples.length, i + size);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    const rms = Math.sqrt(sum / Math.max(1, end - i));
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    out.push(Math.round(Math.max(0, Math.min(1, (db + 52) / 40)) * 99));
  }
  return out;
}
