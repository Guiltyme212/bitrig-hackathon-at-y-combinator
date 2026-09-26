import type { Segment } from '../../src/meditation/types';

// The timing rules of a meditation, kept pure so they can be tested.
// docs/AUDIO_GUIDE.md: pauses go where the listener breathes, notices or imagines,
// and the music plays alone for a little while at both ends.

export type Phrase = { text: string; pause: number };
export type Timed = Phrase & { duration: number };

// Only these delivery tags reach Eleven v3; anything else in brackets is dropped
// so it can't be spoken aloud.
const TAGS = new Set(['warmly', 'gently', 'softly', 'calmly', 'smiling', 'exhales', 'whispers']);
const MIN_PAUSE = 0.6, MAX_PAUSE = 22;
export const MAX_PHRASES = 200;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

// Spoken words for a session of this length: a little under half the time is silence.
export function wordBudget(minutes: number) {
  const fixed: Record<number, number> = { 1: 75, 3: 230, 5: 380, 10: 740 };
  return fixed[minutes] ?? Math.round(minutes * 75);
}

// The session's length and how long the music plays alone before and after.
export function timing(minutes: number) {
  return minutes <= 1 ? { target: 60, intro: 3.5, outro: 6 } : { target: minutes * 60, intro: 7, outro: 10 };
}

// Seconds of silence the writer should plan between phrases.
export function pauseBudget(minutes: number) {
  const t = timing(minutes);
  return Math.max(10, Math.round(t.target - t.intro - t.outro - wordBudget(minutes) / 2.3));
}

export function cleanCaption(text: string) {
  return text.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim();
}

export function sanitizePhrases(raw: Phrase[]): Phrase[] {
  return raw.flatMap(p => {
    const text = String(p.text ?? '')
      .replace(/\[([^\]]*)\]/g, (whole, tag: string) => (TAGS.has(tag.trim().toLowerCase()) ? `[${tag.trim().toLowerCase()}]` : ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (!/[a-z]/i.test(cleanCaption(text))) return [];
    const pause = Number.isFinite(p.pause) ? clamp(Number(p.pause), MIN_PAUSE, MAX_PAUSE) : 1.5;
    return [{ text, pause }];
  // A ten-minute session runs to 120 phrases or so; the cap only guards against a runaway
  // reply, so a real session never loses its ending.
  }).slice(0, MAX_PHRASES);
}

// A pause this long is part of the practice (a breath, an image): it is never cut.
const PRACTICE = 4;

// Places each recorded phrase on the session's clock. With time to spare, every
// pause grows together (up to 1.6×). With too much to say, only the connecting
// pauses shrink (down to 0.5×) and the breaths keep their time; if that still
// isn't enough, the session runs long instead of rushing the listener.
export function layout(phrases: Timed[], plan: { target: number; intro: number; outro: number }) {
  const speech = phrases.reduce((sum, p) => sum + p.duration, 0);
  const pauses = phrases.slice(0, -1).map(p => p.pause);
  const asked = pauses.reduce((sum, p) => sum + p, 0);
  const practice = pauses.filter(p => p >= PRACTICE).reduce((sum, p) => sum + p, 0);
  const free = plan.target - plan.intro - plan.outro - speech;
  const grow = asked > 0 && free >= asked ? Math.min(free / asked, 1.6) : 1;
  const shrink = asked > practice && free < asked ? clamp((free - practice) / (asked - practice), 0.5, 1) : 1;
  const scaled = (p: number) => clamp(grow > 1 ? p * grow : p >= PRACTICE ? p : p * shrink, MIN_PAUSE, MAX_PAUSE);
  const timeline: Segment[] = [];
  let at = plan.intro;
  phrases.forEach((p, i) => {
    timeline.push({ start: round(at), end: round(at + p.duration), text: cleanCaption(p.text) });
    at += p.duration + (i < phrases.length - 1 ? scaled(p.pause) : 0);
  });
  return { timeline, duration: round(at + plan.outro), scale: grow > 1 ? grow : shrink };
}
