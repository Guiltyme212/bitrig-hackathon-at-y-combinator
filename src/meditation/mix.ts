import type { Segment } from './types';

// Generated sessions are timed phrase by phrase, but the music must not dip and
// swell around every phrase (docs/AUDIO_GUIDE.md: no pumping). Phrases closer than
// `bridge` seconds count as one stretch of speech for the ducking; the longer
// silences, where the listener breathes, let the music come back.
export function speechRegions(timeline: Segment[], bridge = 3.2): Segment[] {
  const out: Segment[] = [];
  for (const s of timeline) {
    const last = out[out.length - 1];
    if (last && s.start - last.end < bridge) last.end = Math.max(last.end, s.end);
    else out.push({ start: s.start, end: s.end, text: '' });
  }
  return out;
}

// Reference 09's gentler dip (about −7 dB), the only fully approved pairing.
export const GENERATED_DUCK_FLOOR = 0.447;
