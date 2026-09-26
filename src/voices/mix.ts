export type Segment = { start: number; end: number; text: string };

// The listening room's ducking curve (founder-listening-room/dist/mixer.mjs):
// music settles to `floor` while the voice speaks, with 1.5 s ramps either side.
export function duckAt(time: number, timeline: Segment[], floor: number) {
  'worklet';
  let level = 1;
  for (const s of timeline) {
    const ramp = 1.5;
    let n = 1;
    if (time >= s.start - ramp && time < s.start) n = (s.start - time) / ramp;
    else if (time >= s.start && time <= s.end) n = 0;
    else if (time > s.end && time < s.end + ramp) n = (time - s.end) / ramp;
    level = Math.min(level, n);
  }
  return floor + (1 - floor) * level;
}

// Captions with estimated times. A made meditation's phrases are short and each is
// shown whole (splitting them into sentences flashed words past too fast); a long
// stand-in segment is spread over its sentences by length.
export function captions(timeline: Segment[]) {
  return timeline.flatMap(segment => {
    const text = segment.text.replace(/\s+/g, ' ').trim();
    const sentences = text.length <= 150 ? [text] : text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()) ?? [text];
    const total = sentences.reduce((sum, s) => sum + s.length, 0);
    let at = segment.start;
    return sentences.map(text => {
      const start = at;
      at += ((segment.end - segment.start) * text.length) / total;
      return { start, end: at, text };
    });
  });
}
