import type { FeelingId } from '../stage/script';
import type { Meditation } from '../store';
import type { Brief, NarratorId, Outcome } from './types';

// What a session is for, from the feeling they chose (or, failing that, from
// what they talked about). Dreams and big moments want lift; work wants clarity;
// hurt wants support.
export function outcomeFor(feel: FeelingId | null, kind: string): Outcome {
  if (feel === 'sleep' || kind === 'sleep') return 'sleep';
  if (feel === 'confident' || feel === 'motivated') return 'lift';
  if (feel === 'calmer') return 'settle';
  if (kind === 'breakup' || kind === 'tired') return 'support';
  if (kind === 'event' || kind === 'ambition') return 'lift';
  if (kind === 'work') return 'clarity';
  return feel === 'unsure' ? 'support' : 'settle';
}

// The brief for the engine. Kokoro's brain writes one when it can be reached; the
// authored local conversation falls back to the person's own words.
export function briefFor(m: Meditation, name: string, voiceId?: NarratorId): Brief {
  if (m.brief) return { ...m.brief, minutes: m.minutes, voiceId: voiceId ?? m.brief.voiceId, name: m.brief.name ?? (name || undefined) };
  const words = m.mind.trim().replace(/\s+/g, ' ');
  const quote = words.length <= 140 ? words : `${words.slice(0, 137).replace(/\s+\S*$/, '')}…`;
  return {
    name: name || undefined,
    situation: words.slice(0, 600),
    words: [quote],
    outcome: m.outcome ?? outcomeFor(m.feel, m.kind),
    minutes: m.minutes,
    voiceId,
    title: m.title === 'What’s on your mind' ? undefined : m.title,
  };
}
