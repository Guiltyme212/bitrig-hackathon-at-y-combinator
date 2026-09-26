import type { MakingStage } from '../meditation/types';

// What Kokoro says it's doing while it makes the meditation, one line at a time,
// with a little warmth. The lines follow the engine's real stage; within a stage
// they turn every couple of seconds. Kept pure so the turning can be tested.
export type MakingLineStage = 'writing' | 'recording' | 'mixing';

export function makingLines(voice: string): Record<MakingLineStage, string[]> {
  return {
    writing: ['Listening back to you', 'Choosing the right words', 'Consulting with the monks', 'Adjusting the words', 'Leaving out the clichés'],
    recording: [`Warming up ${voice}’s voice`, `${voice} is recording`, 'Preparing the music', 'Lighting a candle'],
    mixing: ['Tuning the silences', 'Placing every breath', 'Almost ready'],
  };
}

// The line after `index`: on through the stage's list, then round again from its
// second line (the first only opens a stage); the last stage rests on "Almost ready".
export function nextLine(stage: MakingLineStage, index: number, count: number) {
  if (index + 1 < count) return index + 1;
  return stage === 'mixing' ? index : Math.min(1, count - 1);
}

export function stageOf(stage: MakingStage): MakingLineStage {
  return stage === 'recording' ? 'recording' : stage === 'mixing' || stage === 'ready' ? 'mixing' : 'writing';
}
