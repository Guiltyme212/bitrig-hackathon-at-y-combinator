import { devServer } from '../devServer';
import type { Brief } from '../meditation/types';
import { BrainSession, type Proposal } from './session';

// Opens a conversation with Kokoro's brain through the development server (which
// signs it, app/api/brain). Resolves null when there's no brain to be had in time;
// the orb then keeps to its authored local conversation.
export async function openBrain(name: string, wait = 6000): Promise<BrainSession | null> {
  const base = devServer();
  if (!base) return null;
  try {
    const response = await fetch(`${base}/api/brain`);
    if (!response.ok) return null;
    const { url } = await response.json() as { url?: string };
    if (!url) return null;
    const brain = new BrainSession(url, { name });
    const opened = await Promise.race([brain.opened().then(() => true, () => false), new Promise<boolean>(r => setTimeout(() => r(false), wait))]);
    if (!opened) { brain.close(); return null; }
    return brain;
  } catch { return null; }
}

// Asks the server to have these lines ready in Kokoro's voice before they're said,
// so the orb doesn't pause between them.
export function warmVoice(lines: string[], voice = 'brittney') {
  const base = devServer();
  if (!base) return;
  for (const line of lines) void fetch(`${base}/api/speak?text=${encodeURIComponent(line)}&voice=${voice}`).catch(() => {});
}

// The engine's brief, from what the brain proposed and what they said.
export function briefFromProposal(p: Proposal, name: string, minutes: number, said: string[]): Brief {
  const words = [p.quote, p.second_quote].filter((w): w is string => !!w);
  return {
    name: name || undefined,
    situation: p.situation,
    words: words.length ? words : said.slice(0, 1),
    feeling: p.feeling || undefined,
    next: p.next,
    outcome: p.outcome,
    minutes,
    title: p.title,
  };
}
