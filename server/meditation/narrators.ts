import type { NarratorId } from '../../src/meditation/types';

// The approved roster (docs/AUDIO_GUIDE.md). Brittney's approved reference (r2-09)
// and Brad's liked performance (r2-06, a round-one take kept in round two) were both
// slowed to 0.92×; Natasha (r2-05) and Jerry (r2-01) were liked at natural speed.
// Jerry needs pauses inside his narration, which the quiet cuts give him.
export type Narrator = { id: NarratorId; name: string; elevenLabsId: string; tempo: number };

export const narrators: Record<NarratorId, Narrator> = {
  brittney: { id: 'brittney', name: 'Brittney', elevenLabsId: 'pjcYQlDFKMbcOUp6F5GD', tempo: 0.92 },
  natasha: { id: 'natasha', name: 'Natasha', elevenLabsId: 'Atp5cNFg1Wj5gyKD7HWV', tempo: 1 },
  brad: { id: 'brad', name: 'Brad', elevenLabsId: 'HZTk7bUIkiI7yT7FKH4h', tempo: 0.92 },
  jerry: { id: 'jerry', name: 'Jerry', elevenLabsId: 'iRItcIx4sdrKJ1k6Ovv7', tempo: 1 },
};

export const isNarrator = (id: unknown): id is NarratorId => typeof id === 'string' && id in narrators;
