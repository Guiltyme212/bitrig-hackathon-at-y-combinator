import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Text } from '@/Text';
import { useBilling } from '@/billing/revenuecat';
import { useDerivedValue, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import Stage from '@/stage/Stage';
import { FeelDock, TimeDock } from '@/stage/docks';
import { quoted, useConversation } from '@/stage/useConversation';
import { briefFromProposal, openBrain } from '@/brain/client';
import { startMaking } from '@/meditation/api';
import { askFeel, askTime, defaultFeeling, describe, feelings, impliedFeeling, readMind, timeReply, type Feeling, type FeelingId } from '@/stage/script';
import LiquidOrb from '@/orb/LiquidOrb';
import { ListeningMark } from '@/orb/ListeningMark';
import { useOrbTouch } from '@/orb/useOrbTouch';
import { lookValues, tintLook } from '@/orb/liquid';
import { pulse, rgb, useOrbControls } from '@/orb/palette';
import { voiceById, type Voice } from '@/voices/voices';
import { touch } from '@/haptics';
import { GlassButton, GlassCircle } from '@/ui/Glass';
import { TextButton } from '@/ui/Buttons';
import { kokoro, partOfDay, useKokoro } from '@/store';
import { k, withAlpha } from '@/theme';
import { Region, useRegions, type DuoLayout } from '@/layout/Duo';

type Geometry = DuoLayout['geometry'];

function ConfirmDock({ voice, onMake }: { voice: Voice; onMake: () => void }) {
  return <View style={{ gap: 4 }}>
    <GlassButton label={`Make it with ${voice.name}`} tint={withAlpha(voice.accent, 0.9)} appear={120} onPress={onMake} />
    <TextButton label="Change voice" onPress={() => router.push('/voice')} />
  </View>;
}

// Where the conversation's orb sits: today's exact spot on a phone; a home per
// Duo pose otherwise (cx is always the orb page's own centre).
function orbHome(geometry: Geometry, insetsTop: number, cx: number) {
  switch (geometry) {
    case 'closed': case 'closedLandscape': return { y: 116, r: 72 };
    case 'openLandscape': return { y: 290, r: 150 };
    case 'openPortrait': return { y: 200, r: 92 };
    default: return { y: insetsTop + 111, r: 216 * 0.418, x: cx };
  }
}

// "Talk to Kokoro" is the same conversation as the first one, not a chat window:
// Kokoro's lines type out in the middle with haptics, Kokoro's orb brightens with
// each word, and there is one way to answer at a time. One component tree at
// every pose: the orb and the Stage stay mounted (only their Region rects move),
// so the conversation and its audio never restart on a fold.
export default function Chat() {
  const subscription = useBilling();
  const onboarded = useKokoro(s => s.onboarded);
  if (onboarded && (subscription.status === 'idle' || subscription.status === 'loading')) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: k.bg }}><Text style={{ color: k.ink }}>Checking your subscription...</Text></View>;
  }
  // Preserve the existing development demo while its native purchase build is pending.
  // This never grants Pro; release builds and a configured native SDK enforce the gate.
  const purchaseDemoUnavailable = __DEV__ && subscription.status === 'unavailable';
  if (onboarded && !subscription.hasPro && !purchaseDemoUnavailable) return <Redirect href="/paywall" />;
  return <ChatSession />;
}

function ChatSession() {
  const R = useRegions();
  const reduced = !!useReducedMotion();
  const name = useKokoro(s => s.name), voiceId = useKokoro(s => s.voiceId);
  const voice = voiceById(voiceId);
  // Kokoro's own orb is Ember, as in the first conversation, and it borrows a
  // feeling's colour from the wheel.
  const orb = useOrbControls();
  const orbCx = R.orb.rect.w / 2;
  const home = orbHome(R.L.geometry, R.orb.insets.top, orbCx);
  const orbX = home.x ?? orbCx, orbY = home.y, radius = home.r, canvas = Math.ceil(radius * 2.72);
  // Shared frame for phone/closed (one page); the words page's own height when split.
  const frameH = R.split ? R.words.rect.h : R.orb.rect.h;
  const stageTop = R.split ? 76 : orbY + Math.max(96, radius + 19);
  const ember = useMemo(() => lookValues('ember'), []);
  const feelingColor = useSharedValue([1, 1, 1]), feelingAmount = useSharedValue(0);
  const look = useDerivedValue(() => tintLook(ember, feelingColor.get(), feelingAmount.get()));
  // Touching the glass, as in the Orb Lab (the orb eases the finger itself).
  const { gesture: orbGesture, finger } = useOrbTouch(orb.touch, radius);

  // The same conversation as the first run: spoken, typed in time, talk or type.
  const talk = useConversation({ orb, reduced, sound: true, speaker: voiceId });
  const { lines, typingId, ask, say, echo, question, answer, wait } = talk;
  const alive = useRef(true);
  const tintFeeling = (f: Feeling | null) => {
    if (f) feelingColor.set(rgb(f.color));
    feelingAmount.set(withTiming(f ? 0.55 : 0, { duration: f ? 500 : 900 }));
  };

  async function conversation() {
    await wait(500);
    await say(name ? `Good ${partOfDay()}, ${name}.` : `Good ${partOfDay()}.`);
    const brainReady = openBrain(name);
    await say('What’s on your mind?');
    const { words, feel: chosenFeel } = await talk.hearMind();
    echo(quoted(words));
    await wait(500);
    // Talk it out with Kokoro's brain; without one, the authored reading carries on.
    const brain = await brainReady;
    const talked = brain ? await talk.talkItOut(brain, words) : null;
    brain?.close();
    const topic = readMind(words);
    let feeling: FeelingId | null = chosenFeel ?? impliedFeeling(words);
    if (!talked) {
      for (const line of topic.reply) await say(line);
      if (!feeling) {
        await say(askFeel);
        const chosen = await question<Feeling>('feel');
        echo(chosen.label);
        tintFeeling(null);
        await wait(400);
        await say(chosen.reply);
        feeling = chosen.id;
      }
    }
    await say(askTime);
    const minutes = await question<number>('time');
    echo(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    // The meditation starts being written now, while they confirm; it's recorded in
    // whichever voice they confirm with.
    const brief = talked ? briefFromProposal(talked.proposal, name, minutes, talked.said) : null;
    const makingId = brief ? await startMaking(brief) : null;
    await wait(400);
    await say(timeReply(minutes));
    await say(`I’ll make it with ${voiceById(kokoro.get().voiceId).name}.`);
    await question<null>('confirm');
    const chosenVoice = voiceById(kokoro.get().voiceId);
    const base = { title: topic.title, description: describe(topic, feeling, minutes), minutes, voiceId: chosenVoice.id, feel: feeling, mind: words, kind: topic.kind };
    const meditation = talked && brief
      ? { ...base, title: talked.proposal.title, outcome: talked.proposal.outcome, brief: { ...brief, voiceId: chosenVoice.id }, makingId: makingId ?? undefined }
      : base;
    kokoro.set({ makingStartedAt: Date.now(), meditation });
    if (alive.current) router.replace('/making');
  }
  useEffect(() => { alive.current = true; void conversation(); return () => { alive.current = false; }; }, []);
  useEffect(() => { if (ask === 'feel') tintFeeling(feelings[defaultFeeling]); }, [ask]);

  // Development-only QA hook: answer the open question while touch can't be injected.
  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as Record<string, unknown>).__chat = { answer, talk: talk.talk, hear: talk.hear, state: () => ({ ask, lines: lines.map(l => `${l.who}: ${l.text}`) }) };
  });

  const dock = ask === 'mind' || ask === 'listen' || ask === 'proposal' ? talk.mindDock(false)
    : ask === 'feel' ? <FeelDock onSubmit={answer} onChange={tintFeeling} />
    : ask === 'time' ? <TimeDock onSubmit={answer} />
    : ask === 'confirm' ? <ConfirmDock voice={voice} onMake={() => { touch.medium(); answer(null); }} />
    : null;

  return <View style={{ flex: 1, backgroundColor: k.bg }}>
    <Region rect={R.orb.rect} insets={R.orb.insets}>
      <View pointerEvents="box-none" style={{ position: 'absolute', top: orbY - canvas / 2, left: orbX - canvas / 2, width: canvas, height: canvas }}>
        <LiquidOrb size={canvas} radius={radius} look={look} level={orb.level} touch={orb.touch} finger={finger} />
        <GestureDetector gesture={orbGesture}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', left: canvas / 2 - radius, top: canvas / 2 - radius, width: radius * 2, height: radius * 2, borderRadius: radius }} />
        </GestureDetector>
        <ListeningMark listening={ask === 'listen'} level={orb.level} center={canvas / 2} radius={radius} />
      </View>
      <View pointerEvents="box-none" style={{ position: 'absolute', top: R.orb.insets.top + 6, left: 16 }}>
        <GlassCircle icon="xmark" label="Close" color={k.secondary} appear={600} onPress={() => router.back()} />
      </View>
    </Region>
    <Region rect={R.words.rect} insets={R.words.insets}>
      <Stage lines={lines} typingId={typingId} onTyped={talk.onTyped} dock={dock} dockKey={ask ?? 'none'} top={stageTop} reduced={reduced} height={frameH}
        onSkip={talk.hush} onWord={() => pulse(orb.level, talk.speaking ? 0.65 : 0.26)} />
    </Region>
  </View>;
}
