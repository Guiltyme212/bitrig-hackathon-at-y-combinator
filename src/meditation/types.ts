// The shapes shared by the app and the development server's meditation engine.
// Nothing here touches Node or the network, so both sides can import it.

export type Outcome = 'settle' | 'clarity' | 'support' | 'sleep' | 'lift';
export type NarratorId = 'brittney' | 'natasha' | 'brad' | 'jerry';

// What the conversation learned, handed to the writer. Today's situation belongs
// to this one session; it is never saved as a trait of the person.
export type Brief = {
  name?: string;
  situation: string;          // what's going on, in a sentence or two, close to their words
  words: string[];            // up to three things they actually said, to quote back
  feeling?: string;           // the loudest feeling, named plainly ("pressure", "doubt")
  next?: string;              // what the next moment asks of them ("tomorrow's pitch")
  outcome: Outcome;
  minutes: number;
  voiceId?: NarratorId;       // may arrive later: the script is written while the voice is chosen
  title?: string;             // a working title from the conversation, if it offered one
};

export type Segment = { start: number; end: number; text: string };

// A finished meditation: the narration as one file with real silences in it, the
// times of every phrase (captions and the music's ducking), and the voice's
// loudness for the orb.
export type MadeSession = {
  id: string;
  title: string;
  description: string;
  minutes: number;
  voiceId: NarratorId;
  duration: number;           // seconds, including the music-only intro and outro
  timeline: Segment[];
  envelope: number[];         // 0..99 at `envelopeRate` per second
  envelopeRate: number;
  voicePath: string;          // served by the development server
  musicPath?: string;         // a seamless bed, when the session outlasts the voice's three-minute one
};

// 'written': the script is done and waits for a voice.
export type MakingStage = 'writing' | 'written' | 'recording' | 'mixing' | 'ready' | 'failed';
export type MakingStatus = {
  id: string;
  stage: MakingStage;
  done?: number;              // phrases recorded so far
  total?: number;
  error?: string;
  session?: MadeSession;
};

// How far along the making is, 0..1, for the hairline under the status.
export function makingProgress(status: MakingStatus | null): number {
  if (!status) return 0.04;
  switch (status.stage) {
    case 'writing': return 0.18;
    case 'written': return 0.3;
    case 'recording': return 0.3 + 0.55 * ((status.done ?? 0) / Math.max(1, status.total ?? 1));
    case 'mixing': return 0.92;
    case 'ready': return 1;
    default: return 0;
  }
}
