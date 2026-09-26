import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

// The narration, assembled sample by sample: each section's take is decoded once,
// cut back into phrases at the quiet between sentences (never inside a sound), each
// section levelled to the same loudness, and the planned silences laid in with short
// fades. The listening room's lesson (docs/v5/AUDIO_GUIDE.md): long, even takes;
// the pauses are ours.
export const RATE = 44100;
const bin = (name: string) => (existsSync(`/opt/homebrew/bin/${name}`) ? `/opt/homebrew/bin/${name}` : name);
const FFMPEG = bin('ffmpeg');

function run(args: string[], binary = false): Promise<Buffer | string> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { maxBuffer: 512 * 1024 * 1024, encoding: binary ? 'buffer' : 'utf8' }, (error, stdout, stderr) => {
      if (error) reject(new Error(`ffmpeg failed: ${String(stderr).slice(-400)}`));
      else resolve(stdout);
    });
  });
}

// A take as mono float samples at 44.1 kHz, with the narrator's tempo applied.
export async function decode(file: string, tempo: number): Promise<Float32Array> {
  const filters = [...(tempo !== 1 ? [`atempo=${tempo}`] : []), 'highpass=f=65'];
  const raw = await run(['-hide_banner', '-nostdin', '-i', file, '-af', filters.join(','), '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], true) as Buffer;
  const copy = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength - (raw.byteLength % 4));
  return new Float32Array(copy);
}

// Loudness (dBFS RMS) of a 20 ms window centred on `t` seconds.
export function levelAt(pcm: Float32Array, t: number, half = 0.01): number {
  const a = Math.max(0, Math.round((t - half) * RATE)), b = Math.min(pcm.length, Math.round((t + half) * RATE));
  if (b <= a) return -120;
  let sum = 0;
  for (let i = a; i < b; i++) sum += pcm[i] * pcm[i];
  return 10 * Math.log10(sum / (b - a) + 1e-12);
}

const QUIET = -46;

// Where to cut between two phrases of one take: the first moment the voice has
// actually fallen quiet after the earlier phrase ends (so a breath before the next
// phrase stays with it), or the quietest point between them.
export function quietCut(pcm: Float32Array, end: number, next: number): number {
  const lo = Math.max(0, Math.min(end, next) - 0.04), hi = Math.min(pcm.length / RATE, Math.max(end, next) + 0.08);
  let best = (lo + hi) / 2, bestDb = Infinity;
  for (let t = lo; t <= hi; t += 0.005) {
    const db = levelAt(pcm, t);
    if (t >= end && db < QUIET) return t;
    if (db < bestDb) { bestDb = db; best = t; }
  }
  return best;
}

// Trims a piece to its sound: a little lead before the first sound, a short tail
// after the last (natural decay kept), within [from, to].
export function trimmed(pcm: Float32Array, from: number, to: number): { from: number; to: number } {
  let a = from, b = to;
  for (let t = from; t < to; t += 0.005) if (levelAt(pcm, t) > -50) { a = Math.max(from, t - 0.06); break; }
  for (let t = to; t > a; t -= 0.005) if (levelAt(pcm, t) > -50) { b = Math.min(to, t + 0.14); break; }
  return b - a > 0.15 ? { from: a, to: b } : { from, to };
}

// The gain that brings a take's voiced parts to the same loudness as every other
// take (about -20 dBFS RMS, the listening room's level), within ±10 dB.
export function sectionGain(pcm: Float32Array, target = -20): number {
  const hop = Math.round(0.02 * RATE);
  let sum = 0, count = 0;
  for (let i = 0; i + hop <= pcm.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + hop; j++) s += pcm[j] * pcm[j];
    const db = 10 * Math.log10(s / hop + 1e-12);
    if (db > -40) { sum += s; count += hop; }
  }
  if (!count) return 1;
  const rms = 10 * Math.log10(sum / count + 1e-12);
  const db = Math.max(-10, Math.min(10, target - rms));
  return Math.pow(10, db / 20);
}

export type Piece = { pcm: Float32Array; from: number; to: number; gain: number };

// The narration: `intro` seconds of silence, each piece (faded in 8 ms, out 40 ms, at
// its section's gain) followed by its pause, then `outro`.
export function assemble(pieces: Piece[], pauses: number[], intro: number, outro: number): Float32Array {
  const lengths = pieces.map(p => Math.max(0, Math.round((p.to - p.from) * RATE)));
  const total = Math.round(intro * RATE) + lengths.reduce((a, b) => a + b, 0) + pauses.reduce((a, p) => a + Math.round(Math.max(0, p) * RATE), 0) + Math.round(outro * RATE);
  const out = new Float32Array(total);
  let at = Math.round(intro * RATE);
  const fadeIn = Math.round(0.008 * RATE), fadeOut = Math.round(0.04 * RATE);
  pieces.forEach((p, i) => {
    const start = Math.round(p.from * RATE), n = lengths[i];
    for (let k = 0; k < n; k++) {
      const env = Math.min(1, k / fadeIn, (n - 1 - k) / fadeOut);
      out[at + k] = (p.pcm[start + k] ?? 0) * p.gain * Math.max(0, env);
    }
    at += n + Math.round(Math.max(0, pauses[i] ?? 0) * RATE);
  });
  return out;
}

// Writes float samples as a 32-bit float WAV (no clipping before the limiter), then
// encodes the MP3 the app streams, with a gentle limiter for the odd peak.
export async function encodeNarration(samples: Float32Array, wav: string, mp3: string) {
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(3, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(32, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  await writeFile(wav, Buffer.concat([header, data]));
  await run(['-hide_banner', '-nostdin', '-y', '-i', wav, '-af', 'alimiter=limit=0.89:level=0', '-ar', String(RATE), '-ac', '1', '-b:a', '128k', mp3]);
}

// The voice's loudness, 0..99 at `rate` per second, for the orb to breathe with.
export function envelopeOf(samples: Float32Array, rate = 20): number[] {
  const size = Math.round(RATE / rate), out: number[] = [];
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
