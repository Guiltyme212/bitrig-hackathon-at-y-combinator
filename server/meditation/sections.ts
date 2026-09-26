import type { Phrase } from './plan';

// The narrator records whole passages, not single phrases (Dan, 26 September: Brad
// was "uneven, some good quality, some worse" and "between phrases it cuts": every
// phrase was its own take). The listening room's approved tracks were three long
// takes each. So phrases are grouped into sections of up to MAX_CHARS, broken at the
// longest pauses, recorded in one take each, and cut back into phrases at the quiet
// between sentences (see pcm.ts) so every pause still lands exactly.
export const MAX_CHARS = 560;

export type Section = { text: string; phrases: number[]; spans: { start: number; end: number }[] };

// Groups consecutive phrases. A section closes before it would pass MAX_CHARS; when it
// must close, it closes after the phrase with the longest pause in its second half, so
// passages break where the listener was going to rest anyway.
export function sectionsOf(phrases: Phrase[], maxChars = MAX_CHARS): Section[] {
  const out: Section[] = [];
  let group: number[] = [];
  const length = (ids: number[]) => ids.reduce((n, i) => n + phrases[i].text.length + 1, 0);
  const flush = (ids: number[]) => { if (ids.length) out.push(build(phrases, ids)); };
  for (let i = 0; i < phrases.length; i++) {
    if (group.length && length([...group, i]) > maxChars) {
      // Close at the longest pause in the back half of the group (or at its end).
      const from = Math.floor(group.length / 2);
      let cut = group.length - 1;
      for (let k = from; k < group.length; k++) if (phrases[group[k]].pause > phrases[group[cut]].pause) cut = k;
      flush(group.slice(0, cut + 1));
      group = group.slice(cut + 1);
    }
    group.push(i);
  }
  flush(group);
  return out;
}

function build(phrases: Phrase[], ids: number[]): Section {
  let text = '';
  const spans: { start: number; end: number }[] = [];
  for (const i of ids) {
    if (text) text += ' ';
    const start = text.length;
    text += phrases[i].text;
    spans.push({ start, end: text.length });
  }
  return { text, phrases: ids, spans };
}

// Where each phrase is spoken inside its take, from the voice service's character
// timings: [start of its first spoken letter, end of its last spoken letter], in
// seconds of the take (before any tempo change). Tags like [warmly] aren't spoken.
export function phraseTimes(section: Section, starts: number[], ends: number[]): { start: number; end: number }[] {
  return section.spans.map(({ start, end }) => {
    let a = start, b = end - 1;
    const text = section.text;
    // Skip a leading delivery tag and spaces.
    while (a < b && (text[a] === ' ' || text[a] === '[')) {
      if (text[a] === '[') { const close = text.indexOf(']', a); if (close < 0 || close >= b) break; a = close + 1; } else a++;
    }
    while (b > a && text[b] === ' ') b--;
    const s = starts[a], e = ends[b];
    return { start: Number.isFinite(s) ? s : 0, end: Number.isFinite(e) ? e : 0 };
  });
}
