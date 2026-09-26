import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { KEEP_SESSION } from './audioSession';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import GlassIntro from './intro/GlassIntro';
import { glassAt } from './intro/choreography';
import { prismPalette, pulse, rgb, useOrbControls } from './orb/palette';
import { GestureDetector } from 'react-native-gesture-handler';
import LiquidOrb from './orb/LiquidOrb';
import { ListeningMark } from './orb/ListeningMark';
import { useOrbTouch } from './orb/useOrbTouch';
import { lookValues, morphLooks, tintLook } from './orb/liquid';
import Stage, { TypedText } from './stage/Stage';
import { FeelDock, NameDock, TimeDock } from './stage/docks';
import { quoted, useConversation } from './stage/useConversation';
import { prefetchSpeech, warmSpeech } from './voice/speech';
import { briefFromProposal, openBrain } from './brain/client';
import { startMaking } from './meditation/api';
import { askFeel, askMind, askTime, defaultFeeling, describe, feelings, greet, impliedFeeling, intro, readMind, timeReply, type Feeling, type FeelingId } from './stage/script';
import VoiceRoom, { voiceRoomLayout } from './voices/VoiceRoom';
import MakingPhase from './making/MakingPhase';
import { voiceById, voices, type Voice } from './voices/voices';
import { kokoro, type Meditation } from './store';
import { feel, touch } from './haptics';
import { GlassCircle } from './ui/Glass';
import { k } from './theme';
import { POSE_SPRING, Region, useDuo, useRegions } from './layout/Duo';
import type { Placement } from './intro/choreography';

type Phase = 'welcome' | 'room' | 'talk' | 'making';

const GLIDE = Easing.bezier(0.45, 0, 0.2, 1);
// The orb's moves: an unhurried spring that arrives without a bounce.
const SETTLE = { dampingRatio: 0.92 };

// Screen 0 is the Wabi-style glass welcome. Swiping up lifts the glass straight into
// Kokoro's orb, Ember, at the heart of the voice room: the person chooses their guide
// first , and the orb becomes that voice's own orb. It then rises
// above the conversation and the guide talks, in their own voice. Lines type out in
// the middle with haptics and the orb breathes with every word; answers echo in mint,
// one way to answer at a time below. Once the minutes are chosen the meditation is
// made at once (the voice is already known), the orb back at the centre, without a cut.
export default function Onboarding() {
  const window = useWindowDimensions();
  // The iPhone Duo (src/layout): the phone-shaped parts (the thread, the docks, the voice
  // room, making) live on `col` (the closed display's column, or the words page when open)
  // and, open, the one orb keeps to its own page the whole way from landing to reveal.
  const L = useDuo(), R = useRegions(), col = R.words;
  const desktop = Platform.OS === 'web' && window.width > 700 && !L.duo;
  const width = desktop ? 410 : L.duo ? L.window.w : window.width, height = desktop ? 860 : L.duo ? L.window.h : window.height;
  const compact = (L.duo ? col.rect.h : height) < 740;
  const insets = useSafeAreaInsets();
  const top = desktop ? 24 : L.duo ? col.insets.top : insets.top;
  const frame = L.duo ? { width: col.rect.w, height: col.rect.h, top: col.insets.top, bottom: col.insets.bottom } : { width, height, top };
  const duo = duoHomes(L, R);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);

  // The one orb, and the two places it lives: at the heart of the voice room (where the
  // welcome glass lands it, in one move, and where the meditation is made) and above
  // the conversation.
  const stage = duo ? duo.stage.r : (compact ? 146 : 216) * 0.418;
  const stageY = duo ? duo.stage.y : top + (compact ? 76 : 111);
  const phoneRoom = voiceRoomLayout(width, height, top, desktop ? 16 : insets.bottom);
  const room = duo ? { ...phoneRoom, centerY: duo.room.y, sphere: duo.room.r, nameTop: duo.room.y + duo.room.r + 22 } : phoneRoom;
  const orb = useOrbControls();
  const largest = Math.max(stage, room.sphere);
  // One canvas, drawn at the orb's largest and only ever scaled down, so it stays crisp;
  // wider than the sphere for its breath, the voice's swell and a finger's drag (the
  // ball moves up to 0.14 of 0.58 inside it). Nothing is drawn outside the glass.
  const ORB = Math.ceil(largest * 2.72);
  const orbY = useSharedValue(room.centerY), orbR = useSharedValue(room.sphere);
  const orbX = useSharedValue(duo ? duo.x : width / 2);
  const introTarget = { x: duo ? duo.x : width / 2, y: room.centerY, r: room.sphere };
  // Until the welcome has gone, the live orb rides the glass underneath it, so the
  // moment the glass hands over, the orb is exactly where the glass is, even mid-move.
  const introProgress = useSharedValue(0), following = useSharedValue(true);
  // Touching the glass, as in the Orb Lab: a ripple from the spot touched, a breath in
  // while held, the ball and its light following a drag. (Only shared values go into
  // worklets; the gesture object can't be copied there.)
  const { gesture: orbGesture, finger } = useOrbTouch(orb.touch, largest);
  const orbStyle = useAnimatedStyle(() => {
    let x = orbX.get(), y = orbY.get(), r = orbR.get(), opacity = 1;
    if (following.get()) {
      const p = introProgress.get();
      const glass = glassAt(p, width, height, introTarget, duo?.rest);
      x = glass.x; y = glass.y; r = glass.r; opacity = p > 0.85 ? 1 : 0;
    }
    if (!duo) return { opacity, transform: [{ translateY: y - ORB / 2 }, { scale: r / largest }] };
    return { opacity, transform: [{ translateX: x - ORB / 2 }, { translateY: y - ORB / 2 }, { scale: r / largest }] };
  });
  const moveOrb = (y: number, r: number, duration: number) => {
    if (reduced) { orbY.set(y); orbR.set(r); return; }
    orbY.set(withSpring(y, { ...SETTLE, duration }));
    orbR.set(withSpring(r, { ...SETTLE, duration }));
  };
  // Kokoro's orb lands as Ember, then in the voice room it becomes each voice's own
  // orb (one orb, morphing, never a crossfade) and keeps the chosen one; it borrows a
  // feeling's colour from the wheel.
  const ember = useMemo(() => lookValues('ember'), []);
  const feelingColor = useSharedValue([1, 1, 1]), feelingAmount = useSharedValue(0), handoff = useSharedValue(0);
  const look = useDerivedValue(() => tintLook(morphLooks(ember, orb.look.get(), handoff.get()), feelingColor.get(), feelingAmount.get()));

  const [phase, setPhase] = useState<Phase>('welcome');
  const [introMounted, setIntroMounted] = useState(true);
  // Its place in the voice room follows the layout (the safe area can arrive a frame
  // late) until it rises to the conversation.
  useEffect(() => {
    if (phase !== 'welcome' && phase !== 'room') return;
    if (duo && phase === 'room' && !reduced) { orbY.set(withSpring(room.centerY, POSE_SPRING)); orbR.set(withSpring(room.sphere, POSE_SPRING)); return; }
    orbY.set(room.centerY);
    orbR.set(room.sphere);
  }, [phase, room.centerY, room.sphere, orbY, orbR]);
  // iPhone Duo: folding, unfolding or turning it moves the orb to its home in the new pose,
  // in one unhurried move (the thread and docks glide with their page, see Region).
  const homeX = duo ? duo.x : width / 2;
  useEffect(() => {
    if (!duo) return;
    orbX.set(reduced ? homeX : withSpring(homeX, POSE_SPRING));
    if (phase === 'talk') moveOrb(stageY, stage, POSE_SPRING.duration);
    if (phase === 'making') moveOrb(room.centerY, room.sphere, POSE_SPRING.duration);
  }, [L.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // The guide's first lines are made ready in every voice while the welcome is on
  // screen, so whichever voice is chosen speaks at once.
  useEffect(() => { for (const v of voices) warmSpeech(intro, v.id); }, []);
  const [speaker, setSpeaker] = useState('brittney');

  // The conversation, written as a script: say, ask, echo.
  const [sound, setSound] = useState(true), [started, setStarted] = useState(false), [hushed, setHushed] = useState(false), [ended, setEnded] = useState(false);
  const talk = useConversation({ orb, reduced, sound, speaker });
  const { lines, typingId, ask, say, echo, question, answer, wait, hush } = talk;
  const [leaving, setLeaving] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [made, setMade] = useState<{ meditation: Meditation; voice: Voice } | null>(null);
  const [talking, setTalking] = useState(false);
  const closingDone = useRef<(() => void) | null>(null);

  // The ambient bed, softly under the conversation; lower while Kokoro speaks,
  // hushed while a voice auditions, silent while Kokoro listens to you.
  const listening = ask === 'listen';
  const music = useAudioPlayer(require('../assets/audio/arrival.mp3'), KEEP_SESSION);
  useEffect(() => {
    music.loop = true;
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }, [music]);
  // Every call into the player is guarded: iOS can release its session (a call, the
  // microphone prompt, going to the background), and a paused bed is better than a crash.
  const on = started && sound && !ended && !listening;
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      try { if (state !== 'active') music.pause(); else if (on) music.play(); } catch {}
    });
    return () => sub.remove();
  }, [music, on]);
  // The bed fades in and glides between levels (lower while Kokoro speaks) instead of jumping.
  useEffect(() => {
    const target = hushed ? 0.03 : talk.speaking ? 0.1 : 0.22;
    try {
      if (!on) { music.pause(); return; }
      if (!music.playing) { music.volume = 0; music.play(); }
    } catch { return; }
    let volume = 0;
    try { volume = music.volume; } catch {}
    const id = setInterval(() => {
      volume += (target - volume) * 0.18;
      const done = Math.abs(target - volume) < 0.004;
      try { music.volume = done ? target : volume; } catch { clearInterval(id); return; }
      if (done) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [on, hushed, music, talk.speaking]);

  // The orb borrows the colour of the feeling on the wheel, then lets it go.
  const tintFeeling = (f: Feeling | null) => {
    if (f) feelingColor.set(rgb(f.color));
    feelingAmount.set(withTiming(f ? 0.55 : 0, { duration: f ? 500 : 900 }));
  };
  useEffect(() => { if (ask === 'feel') tintFeeling(feelings[defaultFeeling]); }, [ask]);

  // First the guide: the voice room opens around the orb as it lands; the chosen voice's
  // orb stays, rises above the conversation, and that voice speaks from then on.
  async function chooseGuide() {
    orb.palette.set(prismPalette);
    handoff.set(reduced ? 1 : withDelay(200, withTiming(1, { duration: 1200, easing: GLIDE })));
    const voice = await question<Voice>('voice');
    orb.palette.set(voice.palette);
    setSpeaker(voice.id);
    if (sound) prefetchSpeech(intro, voice.id);
    setLeaving(true);
    await wait(460);
    setClosing(`${voice.name} it is.`);
    await new Promise<void>(r => { closingDone.current = r; });
    await wait(500);
    setClosing(null);
    moveOrb(stageY, stage, 1100);
    await wait(reduced ? 0 : 450);
    setPhase('talk');
    kokoro.set({ voiceId: voice.id });
    await wait(reduced ? 0 : 350);
    await conversation(voice);
  }

  async function conversation(voice: Voice) {
    setTalking(true);
    for (const line of intro) await say(line);
    const name = await question<string>('name');
    // What Kokoro says next depends on the name: load it while the name settles.
    if (sound) prefetchSpeech([...greet(name), askMind(name)], voice.id);
    if (name) echo(name);
    await wait(450);
    for (const line of greet(name)) await say(line);

    // Kokoro's brain gets ready while they think about what to say.
    const brainReady = openBrain(name);
    await say(askMind(name));
    const { words, feel: chosenFeel } = await talk.hearMind();
    echo(quoted(words));
    await wait(520);
    // Talk it out: reflect, one real question, a proposal. Without a brain (no
    // server, no network), the authored reading of their words carries on.
    const brain = await brainReady;
    const talked = brain ? await talk.talkItOut(brain, words) : null;
    brain?.close();
    // A head start: the question offers 5 or 10 minutes, so five minutes' worth starts
    // being written and recorded now, while they answer. Any other length starts fresh.
    const briefFor = (minutes: number) => (talked ? { ...briefFromProposal(talked.proposal, name, minutes, talked.said), voiceId: voice.id } : null);
    const guess = talked ? startMaking(briefFor(5)!) : Promise.resolve(null);
    const topic = readMind(words);
    let feeling: FeelingId | null = chosenFeel ?? impliedFeeling(words);
    if (!talked) {
      for (const line of topic.reply) await say(line);
      if (!feeling) {
        await say(askFeel);
        const chosen = await question<Feeling>('feel');
        echo(chosen.label);
        tintFeeling(null);
        await wait(420);
        await say(chosen.reply);
        feeling = chosen.id;
      }
    }

    await say(askTime);
    const minutes = await question<number>('time');
    echo(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    // The voice is known, so the meditation is written and recorded from this moment
    // (already, if they chose five).
    const brief = briefFor(minutes);
    const making = !brief ? Promise.resolve(null) : minutes === 5 ? guess : startMaking(brief);
    await wait(420);
    await say(timeReply(minutes));
    const makingId = await making;

    const meditation: Meditation = talked && brief
      ? { title: talked.proposal.title, description: describe(topic, feeling, minutes), minutes, voiceId: voice.id, feel: feeling, mind: words, kind: topic.kind,
          outcome: talked.proposal.outcome, brief, makingId: makingId ?? undefined }
      : { title: topic.title, description: describe(topic, feeling, minutes), minutes, voiceId: voice.id, feel: feeling, mind: words, kind: topic.kind };
    kokoro.set({ name, voiceId: voice.id, meditation, makingStartedAt: Date.now() });
    if (!talk.isAlive()) return;
    // The orb goes back to the centre and makes it there.
    moveOrb(room.centerY, room.sphere, 1100);
    setMade({ meditation, voice });
    setPhase('making');
  }

  // The glass has become the orb, already in its place at the heart of the voice room
  // (its landing bursts in the hand): the room opens around it. The bed follows.
  function arriveFromIntro() {
    setPhase('room');
    setTimeout(() => setStarted(true), reduced ? 0 : 900);
    void chooseGuide();
  }

  // Development-only QA hook: answer the open question, speed up typing, skip the welcome.
  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as Record<string, unknown>).__onboarding = {
      state: () => ({ phase, ask, typing: typingId, lines: lines.map(l => `${l.who}: ${l.text}`) }),
      answer,
      voice: (id: string) => answer(voiceById(id)),
      fast: talk.fast,
      enter: () => { following.set(false); setIntroMounted(false); setStarted(true); arriveFromIntro(); },
      talk: talk.talk,
      hear: talk.hear,
      // The orb's touch inputs, to play a finger through them (the simulator can't).
      hand: { finger, touch: orb.touch, radius: largest },
    };
  });

  const dock = ask === 'name' ? <NameDock onSubmit={answer} />
    : ask === 'mind' || ask === 'listen' || ask === 'proposal' ? talk.mindDock()
    : ask === 'feel' ? <FeelDock onSubmit={answer} onChange={tintFeeling} />
    : ask === 'time' ? <TimeDock onSubmit={answer} />
    : null;
  const textTop = room.nameTop + 8;
  const stageTop = duo && R.split ? col.insets.top + (L.geometry === 'openPortrait' ? 8 : 40) : stageY + Math.max(96, stage + 19);
  // "{Voice} it is." sits under the orb: on its own page when the Duo is open.
  const closingBox = !duo ? { left: 32, right: 32, top: textTop }
    : R.split ? { left: R.orb.rect.x + 24, width: R.orb.rect.w - 48, top: room.centerY + room.sphere + 26 }
    : { left: col.rect.x + 32, width: col.rect.w - 64, top: textTop };
  const soundBox = !duo ? { top: top + 6, right: 16 }
    : L.geometry === 'openPortrait' ? { top: R.orb.rect.y + 12, left: R.orb.rect.x + R.orb.rect.w - 16 - 44 }
    : { top: col.rect.y + col.insets.top + 6, left: col.rect.x + col.rect.w - 16 - 44 };

  return <View style={styles.page}>
    <View style={[styles.phone, { width, height }, desktop && styles.desktopPhone]}>
      <StatusBar style="light" />
      <Animated.View pointerEvents="box-none" style={[styles.orb, { width: ORB, height: ORB, left: duo ? 0 : width / 2 - ORB / 2 }, orbStyle]}>
        <LiquidOrb size={ORB} radius={largest} look={look} level={orb.level} touch={orb.touch} paused={phase === 'welcome'} finger={finger} />
        {phase !== 'welcome' && <GestureDetector gesture={orbGesture}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={{ position: 'absolute', left: ORB / 2 - largest, top: ORB / 2 - largest, width: largest * 2, height: largest * 2, borderRadius: largest }} />
        </GestureDetector>}
        <ListeningMark listening={listening} level={orb.level} center={ORB / 2} radius={largest} />
      </Animated.View>

      {talking && <Region rect={col.rect} insets={col.insets}>
        <Stage lines={lines} typingId={typingId} onTyped={talk.onTyped} dock={dock} dockKey={ask ?? 'none'}
          top={stageTop} reduced={reduced} hidden={phase !== 'talk'} height={duo ? col.rect.h : height} onSkip={hush} onWord={() => pulse(orb.level, talk.speaking ? 0.65 : 0.26)} />
      </Region>}

      {phase === 'room' && <Region rect={col.rect} insets={col.insets}>
        <VoiceRoom orb={orb} renderOrb={false} initial="natasha" reduced={reduced} enterDelay={reduced ? 0 : 500} frame={frame} aside={R.split} leaving={leaving}
          onChoose={answer} onAudition={playing => setHushed(playing)} />
      </Region>}

      {closing && <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(260)} pointerEvents="none" style={{ position: 'absolute', ...closingBox }}>
        <TypedText text={closing} color={k.ink} run instant={reduced} onDone={() => closingDone.current?.()} onWord={() => pulse(orb.level, 0.3)}
          style={{ fontSize: 24, lineHeight: 31, letterSpacing: -0.45, textAlign: 'center' }} />
      </Animated.View>}

      {phase === 'making' && made && <Region rect={col.rect} insets={col.insets}>
        <MakingPhase orb={orb} meditation={made.meditation} voice={made.voice} firstRun reduced={reduced} frame={frame} aside={R.split}
          onPlay={() => { setEnded(true); router.push('/preview'); }} />
      </Region>}

      {phase !== 'welcome' && <View pointerEvents={phase === 'talk' ? 'box-none' : 'none'} style={{ position: 'absolute', ...soundBox }}>
        <GlassCircle icon={sound ? 'speaker.wave.2' : 'speaker.slash'} label={sound ? 'Turn sound off' : 'Turn sound on'} color={k.secondary}
          appear={1400} hidden={phase !== 'talk'} onPress={() => { if (sound) hush(); setStarted(true); setSound(v => !v); touch.light(); }} />
      </View>}

      {introMounted && <GlassIntro width={width} height={height} target={introTarget} rest={duo?.rest} words={duo?.words} progress={introProgress} reduced={reduced}
        onCommit={() => {}} onArrive={arriveFromIntro} onDone={() => { following.set(false); setIntroMounted(false); }} feel={moment => void feel(moment)} />}
    </View>
  </View>;
}

// iPhone Duo: where the one orb lives in each pose, where the welcome's glass rests and
// where its words go. Closed, it is the phone's composition inside the 382 column. Open,
// the orb keeps to its page (the room) the whole first run and barely moves between the
// voice room and the conversation; the welcome is a planet rising at the foot of that
// page with its words on the other, like a book's cover opening.
type DuoHomes = { x: number; room: { y: number; r: number }; stage: { y: number; r: number }; rest: Placement; words: { x: number; w: number; top: number; invite: number } };
function duoHomes(L: ReturnType<typeof useDuo>, R: ReturnType<typeof useRegions>): DuoHomes | null {
  if (!L.duo) return null;
  const W = L.window.w, H = L.window.h, col = R.words;
  if (!R.split) {
    const w = col.rect.w, h = col.rect.h, t = col.insets.top, b = col.insets.bottom;
    const room = voiceRoomLayout(w, h, t, b, false, true);
    const compact = h < 740;
    const cx = col.rect.x + w / 2, dome = w * 1.107 * 1.12;
    return {
      x: cx, room: { y: col.rect.y + room.centerY, r: room.sphere },
      stage: { y: col.rect.y + t + (compact ? 76 : 111), r: (compact ? 146 : 216) * 0.418 },
      rest: { x: cx, y: H * 0.7125 + dome, r: dome },
      words: { x: col.rect.x, w, top: H * 0.345, invite: H * 0.878 },
    };
  }
  const page = R.orb.rect, cx = page.x + page.w / 2;
  if (L.geometry === 'openPortrait') {
    const cy = page.y + page.h * 0.52, r = Math.min(page.w, page.h) * 0.3, dome = W * 1.107;
    return {
      x: cx, room: { y: cy, r }, stage: { y: cy, r: r * 0.94 },
      rest: { x: W / 2, y: H * 0.72 + dome, r: dome },
      words: { x: page.x, w: page.w, top: page.y + page.h * 0.3, invite: H * 0.878 },
    };
  }
  const r = Math.min(page.w * 0.3, page.h * 0.21), cy = page.y + page.h * 0.46, dome = Math.max(page.w * 1.14, 480);
  return {
    x: cx, room: { y: cy, r }, stage: { y: cy, r: r * 1.08 },
    rest: { x: cx, y: H * 0.7 + dome, r: dome },
    words: { x: col.rect.x, w: col.rect.w, top: H * 0.28, invite: H * 0.66 },
  };
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  phone: { backgroundColor: '#000', overflow: 'hidden' },
  desktopPhone: { borderRadius: 40, borderWidth: 1, borderColor: '#232326' },
  orb: { position: 'absolute', top: 0 },
});
