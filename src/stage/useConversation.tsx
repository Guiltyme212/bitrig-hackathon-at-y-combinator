import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { touch } from '../haptics';
import { report } from '../devLog';
import type { OrbControls } from '../orb/palette';
import { canTalk, prepareSpeech, transcribe, type Speech } from '../voice/speech';
import { ListeningDock, MindDock, type Heard } from './docks';
import { deniedLine, lostLine, unheardLine, type FeelingId } from './script';
import type { Line } from './Stage';
import ProposalDock from './ProposalDock';
import { linesOf, type BrainSession, type Proposal } from '../brain/session';
import { warmVoice } from '../brain/client';

type MindAnswer = { kind: 'text'; text: string; feel: FeelingId | null } | { kind: 'talk' };
// What they said, as it echoes on the stage.
export const quoted = (words: string) => (words.length > 96 ? `“${words.slice(0, 94).trim()}…”` : `“${words}”`);

// Kokoro's side of a conversation, shared by the first run and "Talk to Kokoro":
// each line is spoken aloud (when sound is on and the voice can be reached) while
// its words type in time with it; one question is open at a time; and the open
// question can be answered by talking or typing. Talking is the only path to the
// microphone prompt, and while it listens the orb shows a microphone.
// `speaker` is the voice Kokoro speaks in: the narrator chosen at the start.
export function useConversation({ orb, reduced, sound, speaker = 'brittney' }: { orb: OrbControls; reduced: boolean; sound: boolean; speaker?: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [typeFirst, setTypeFirst] = useState(false), [micAllowed, setMicAllowed] = useState(canTalk());
  const [chips, setChips] = useState(true), [proposal, setProposal] = useState<Proposal | null>(null);
  const seq = useRef(0), typing = useRef<string | null>(null), fast = useRef(false), alive = useRef(true);
  const pendingSay = useRef<(() => void) | null>(null), pendingAsk = useRef<((value: unknown) => void) | null>(null);
  const simulated = useRef<string | null>(null);
  const voice = useRef<Speech | null>(null), soundOn = useRef(sound), speakerRef = useRef(speaker);
  soundOn.current = sound;
  speakerRef.current = speaker;
  const hush = () => { voice.current?.stop(); voice.current = null; };
  useEffect(() => { alive.current = true; return () => { alive.current = false; hush(); }; }, []);

  const wait = (ms: number) => new Promise<void>(r => setTimeout(r, fast.current || reduced ? Math.min(ms, 60) : ms));
  const say = async (text: string) => {
    const speech = soundOn.current && !fast.current ? await prepareSpeech(text, 3000, speakerRef.current) : null;
    if (!alive.current) { speech?.stop(); return; }
    await new Promise<void>(resolve => {
      const id = `k${seq.current++}`;
      let typed = false, spoken = !speech;
      const settle = () => { if (!typed || !spoken) return; setSpeaking(false); setTimeout(resolve, fast.current ? 30 : 320); };
      pendingSay.current = () => { typed = true; settle(); };
      typing.current = id;
      if (speech) {
        voice.current = speech;
        setSpeaking(true);
        void speech.play().then(() => { if (voice.current === speech) voice.current = null; spoken = true; settle(); });
      }
      setLines(l => [...l, { id, who: 'kokoro', text, spoken: speech?.duration }]);
      setTypingId(id);
    });
  };
  const onTyped = (id: string) => {
    if (id !== typing.current) return;
    typing.current = null;
    setTypingId(null);
    const typed = pendingSay.current;
    pendingSay.current = null;
    typed?.();
  };
  const echo = (text: string) => { touch.light(); setLines(l => [...l, { id: `y${seq.current++}`, who: 'you', text }]); };
  const question = <T,>(kind: string) => new Promise<T>(resolve => { pendingAsk.current = resolve as (value: unknown) => void; setAsk(kind); });
  const answer = (value: unknown) => {
    const resolve = pendingAsk.current;
    if (!resolve) return;
    pendingAsk.current = null;
    Keyboard.dismiss();
    setAsk(null);
    resolve(value);
  };

  // What's on their mind: spoken, typed, or a shortcut. Refusals and failures
  // become typing; nothing ever blocks the meditation.
  async function hearMind(withChips = true): Promise<{ words: string; feel: FeelingId | null }> {
    setChips(withChips);
    for (;;) {
      const mind = await question<MindAnswer>('mind');
      if (mind.kind === 'text') return { words: mind.text, feel: mind.feel };
      // Straight to listening: a microphone settles into the orb and the dock says
      // "I'm listening" (a spoken line first only delayed it and confused people).
      const heard = await question<Heard>('listen');
      report('hear:heard', { kind: heard.kind, seconds: heard.kind === 'clip' ? heard.seconds : undefined });
      if (heard.kind === 'type') { setTypeFirst(true); continue; }
      if (heard.kind === 'denied') { setMicAllowed(false); for (const line of deniedLine) await say(line); continue; }
      if (heard.kind === 'error') { setTypeFirst(true); for (const line of lostLine) await say(line); continue; }
      if (!heard.seconds) { for (const line of unheardLine) await say(line); continue; }
      // While the words are written down, the orb holds its breath.
      orb.level.set(withTiming(0.3, { duration: 300 }));
      const text = simulated.current ?? await transcribe(heard.uri);
      simulated.current = null;
      orb.level.set(withTiming(0, { duration: 500 }));
      report('hear:words', { words: text === null ? 'failed' : text.split(/\s+/).filter(Boolean).length });
      if (text) return { words: text, feel: null };
      if (text === '') { for (const line of unheardLine) await say(line); continue; }
      setTypeFirst(true);
      for (const line of lostLine) await say(line);
    }
  }

  // While Kokoro's brain answers, the orb breathes slowly.
  const think = (on: boolean) => orb.level.set(on
    ? withRepeat(withSequence(withTiming(0.3, { duration: 900 }), withTiming(0.1, { duration: 1100 })), -1)
    : withTiming(0, { duration: 500 }));

  // Talking it out with Kokoro's brain: it reflects what they said, asks one real
  // question if it needs one, then proposes the meditation it will make, which a
  // tap accepts ("Change something" goes round again). Null means the brain went
  // quiet: the caller carries on with the authored conversation.
  async function talkItOut(brain: BrainSession, first: string): Promise<{ proposal: Proposal; said: string[] } | null> {
    const said = [first];
    let text = first;
    for (let turn = 0; turn < 6 && alive.current; turn++) {
      think(true);
      let result;
      try { result = await brain.send(text); } catch { think(false); return null; }
      think(false);
      const spoken = linesOf(result.reply);
      warmVoice(spoken.slice(1), speakerRef.current);        // the first is fetched as it's said
      for (const line of spoken) await say(line);
      if (result.proposal) {
        setProposal(result.proposal);
        const choice = await question<'make' | 'change'>('proposal');
        if (choice === 'make') return { proposal: result.proposal, said };
        await say('What should I change?');
      } else if (!spoken.length) return null;
      // A reply that neither asks nor proposes leaves them nothing to answer.
      else if (!/\?\s*$/.test(result.reply)) await say('Tell me a little more, or just say make it.');
      const next = await hearMind(false);
      echo(quoted(next.words));
      said.push(next.words);
      text = next.words;
    }
    return null;
  }

  // The dock for the open question, or null when another question is open.
  const mindDock = (disclosure = true) => ask === 'mind'
    ? <MindDock talk={micAllowed} typing={typeFirst} disclosure={disclosure && chips} chips={chips} onSubmit={text => answer({ kind: 'text', text, feel: null })}
        onShortcut={(label, f) => answer({ kind: 'text', text: label, feel: f })} onTalk={() => { hush(); answer({ kind: 'talk' }); }} />
    : ask === 'listen' ? <ListeningDock onHeard={answer} onLevel={level => orb.level.set(level)} />
    : ask === 'proposal' && proposal ? <ProposalDock title={proposal.title} onMake={() => answer('make')} onChange={() => answer('change')} />
    : null;

  return {
    lines, typingId, ask, speaking, say, onTyped, echo, question, answer, wait, hush, hearMind, mindDock, talkItOut, proposal,
    isAlive: () => alive.current,
    fast: (on = true) => { fast.current = on; },
    // Development: as if the person had said `text` to the orb (the simulator has no voice to give).
    hear: (text: string) => { simulated.current = text; answer({ kind: 'clip', uri: 'simulated', seconds: 3 }); },
    talk: () => answer({ kind: 'talk' }),
  };
}
