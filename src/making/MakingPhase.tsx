import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useDuo, useFrameSize } from '../layout/Duo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useFrameCallback, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../Text';
import { touch } from '../haptics';
import { GlassButton } from '../ui/Glass';
import { pulse, type OrbControls } from '../orb/palette';
import LiquidOrb from '../orb/LiquidOrb';
import { voiceRoomLayout } from '../voices/VoiceRoom';
import type { Voice } from '../voices/voices';
import { kokoro, type Meditation } from '../store';
import { canMake, chooseVoice, followMaking, goldenSession, startMaking } from '../meditation/api';
import { briefFor } from '../meditation/brief';
import { makingProgress, type MadeSession, type MakingStatus } from '../meditation/types';
import { makingLines, nextLine, stageOf, type MakingLineStage } from './lines';
import { k, withAlpha } from '../theme';
import { rise } from '../ui/motion';

const THIN = Platform.select({ ios: 'AvenirNext-UltraLight', default: undefined });
const REGULAR = Platform.select({ ios: 'AvenirNext-Regular', default: undefined });

const TURN = 2300;        // ms a line stays before the next one
const HOLD = 1400;        // a line is never replaced sooner, even when the engine moves on
const AT_LEAST = 5000;    // the making is seen at least this long before the reveal
const LOCAL = 7200;       // without the engine, the stand-in making takes this long
const LINE = 220;         // the progress line's length
// About how long making takes, by length (seconds): the line's pace until the engine reports.
const EXPECTED: Record<number, number> = { 1: 16, 3: 24, 5: 30, 10: 44 };

type Props = {
  orb: OrbControls;
  renderOrb?: boolean;           // false when the caller already draws the orb in the room's place
  meditation: Meditation;
  voice: Voice;
  firstRun: boolean;
  onReady?: () => void;
  onPlay: () => void;
  reduced: boolean;
  frame?: { width: number; height: number; top: number; bottom?: number };
  aside?: boolean;               // iPhone Duo, open: the orb is on the other page
};

// Making, as something you watch happen: the orb breathes while one quiet line at a
// time says what Kokoro is doing, with a little warmth ("Consulting with the monks").
// Never their own answers read back (Dan, 26 September: that "only makes sense for a
// program"). The meditation is made for real meanwhile (src/meditation/api.ts): the
// lines follow the engine's stage, the hairline its progress, and the reveal waits
// until it's ready; then a quickening of taps lands on one firm beat and the
// meditation is revealed by its own name.
export default function MakingPhase({ orb, renderOrb = false, meditation, voice, firstRun, onReady, onPlay, reduced, frame, aside = false }: Props) {
  const window = useFrameSize();
  const insets = useSafeAreaInsets();
  const width = frame?.width ?? window.width, height = frame?.height ?? window.height, top = frame?.top ?? insets.top;
  const bottom = frame?.bottom ?? (frame ? 16 : insets.bottom);
  const duoLayout = useDuo();
  const layout = voiceRoomLayout(width, height, top, bottom, aside, duoLayout.duo && !aside);
  const lines = useMemo(() => makingLines(voice.name), [voice]);
  const [line, setLine] = useState(lines.writing[0]);
  const [ready, setReady] = useState(false);
  // What the engine made. `local` means it couldn't be reached or failed and there
  // was no pre-made session: the stand-in tracks play, as before.
  const [made, setMade] = useState<MadeSession | null>(null);
  const [local, setLocal] = useState(false);
  const [seen, setSeen] = useState(false);
  const cancel = useRef<(() => void) | null>(null);
  // The line moves on its own, smoothly, toward whichever is further: the engine's real
  // progress or a gentle estimate from the time spent (so it never stalls or jumps, Dan:
  // "the line is going unevenly"), and glides to the end once the meditation is ready.
  const bar = useSharedValue(0), shownBar = useSharedValue(0), since = useSharedValue(0);
  const expected = EXPECTED[meditation.minutes] ?? 30;
  useFrameCallback(frame => {
    if (!since.get()) since.set(frame.timestamp);
    const t = (frame.timestamp - since.get()) / 1000;
    const done = bar.get() >= 0.999;
    const estimate = 0.9 * (1 - Math.exp(-t / (expected * 0.55)));
    const goal = done ? 1 : Math.min(0.97, Math.max(bar.get(), estimate));
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    shownBar.set(shownBar.get() + (goal - shownBar.get()) * (1 - Math.exp(-dt * (done ? 5 : 1.4))));
  });
  // A soft light rides the tip; a faint sheen passes along the line.
  const tip = useSharedValue(0.55), sheen = useSharedValue(0);
  useEffect(() => {
    tip.set(withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.sin) })), -1));
    sheen.set(withRepeat(withSequence(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 700 })), -1));
  }, [tip, sheen]);

  // The line on screen (its stage, its place in that stage's list, when it appeared)
  // and the stage the engine has reached. A ticker turns the lines: on to the new
  // stage once the current line has been read, otherwise the next line every TURN ms.
  const shown = useRef<{ stage: MakingLineStage; index: number; since: number }>({ stage: 'writing', index: 0, since: Date.now() });
  const target = useRef<MakingLineStage>('writing');
  const over = useRef(false);        // revealed: the lines (and their taps) stop
  useEffect(() => {
    const show = (stage: MakingLineStage, index: number) => {
      shown.current = { stage, index, since: Date.now() };
      setLine(lines[stage][index]);
      pulse(orb.level, 0.3);
      touch.soft();
    };
    const id = setInterval(() => {
      if (over.current) { clearInterval(id); return; }
      const now = Date.now(), { stage, index, since } = shown.current;
      if (target.current !== stage) { if (now - since >= HOLD) show(target.current, 0); return; }
      if (now - since < TURN) return;
      const next = nextLine(stage, index, lines[stage].length);
      if (next !== index) show(stage, next);
    }, 200);
    return () => clearInterval(id);
  }, [lines, orb]);

  useEffect(() => {
    // The orb breathes while it works.
    orb.level.set(withRepeat(withSequence(withTiming(0.34, { duration: 1300, easing: Easing.inOut(Easing.sin) }), withTiming(0.12, { duration: 1500, easing: Easing.inOut(Easing.sin) })), -1));
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => setSeen(true), reduced ? 1200 : AT_LEAST)];
    let stop = () => {};
    let alive = true;
    const goLocal = () => {
      if (!alive) return;
      bar.set(withTiming(1, { duration: LOCAL, easing: Easing.inOut(Easing.quad) }));
      timers.push(setTimeout(() => { target.current = 'recording'; }, LOCAL / 3), setTimeout(() => { target.current = 'mixing'; }, (LOCAL * 2) / 3),
        setTimeout(() => { if (alive) setLocal(true); }, LOCAL));
    };
    // Make it for real: continue the job the conversation started (it wrote the
    // script while the voice was chosen), or start one now.
    void (async () => {
      if (!canMake()) { goLocal(); return; }
      let id = meditation.makingId;
      if (id && !(await chooseVoice(id, voice.id))) id = undefined;
      if (!id) id = await startMaking(briefFor(meditation, kokoro.get().name, voice.id)) ?? undefined;
      if (!alive) return;
      if (!id) { goLocal(); return; }
      bar.set(withTiming(makingProgress(null), { duration: 600 }));
      const adopt = (session: MadeSession) => {
        const current = kokoro.get();
        kokoro.set({
          made: { ...current.made, [session.id]: session },
          meditation: current.meditation ? { ...current.meditation, makingId: id, narrationId: session.id, title: session.title, description: session.description || current.meditation.description } : current.meditation,
        });
        target.current = 'mixing';
        setMade(session);
      };
      stop = followMaking(id, (status: MakingStatus) => {
        if (!alive) return;
        bar.set(withTiming(makingProgress(status), { duration: 900, easing: Easing.out(Easing.quad) }));
        if (status.stage === 'ready' && status.session) adopt(status.session);
        else if (status.stage === 'failed') {
          // The demo's safety net: the founder session made ahead of time, in this voice.
          if (__DEV__) console.warn('Making failed:', status.error);
          void goldenSession(voice.id).then(golden => { if (!alive) return; if (golden) adopt(golden); else goLocal(); });
        } else target.current = stageOf(status.stage);
      }, 90_000);
    })();
    return () => { alive = false; stop(); timers.forEach(clearTimeout); cancel.current?.(); };
  }, []);

  // The reveal waits for both: the making has been seen, and the meditation exists.
  useEffect(() => {
    if (!seen || ready || (!made && !local)) return;
    over.current = true;
    // The charge: the orb gathers light while the taps quicken, then lands.
    orb.level.set(withTiming(1, { duration: 1150, easing: Easing.in(Easing.quad) }));
    cancel.current = touch.crescendo(reduced ? 300 : 1150, () => {
      orb.level.set(withSequence(withTiming(1, { duration: 1 }), withTiming(0.12, { duration: 1400, easing: Easing.out(Easing.cubic) }),
        withRepeat(withSequence(withTiming(0.24, { duration: 2200, easing: Easing.inOut(Easing.sin) }), withTiming(0.08, { duration: 2600, easing: Easing.inOut(Easing.sin) })), -1)));
      setReady(true);
      onReady?.();
    });
  }, [seen, made, local, ready]);
  const title = made?.title ?? meditation.title, description = made?.description || meditation.description;
  // A meditation made for them plays whole, even the first time; the stand-in is a preview.
  const note = !firstRun ? 'Made from what you shared. It’s in your library.'
    : made ? `Your first meditation · ${meditation.minutes} min`
    : meditation.minutes <= 1 ? 'Your first meditation · 1 min, free' : 'Free preview · 45 sec';

  // iPhone Duo, open: the making sits level with the orb on the other page.
  const statusTop = aside ? height * 0.42 - 50 : layout.nameTop + 6;
  const fill = useAnimatedStyle(() => ({ width: shownBar.get() * LINE }));
  const tipStyle = useAnimatedStyle(() => ({ opacity: tip.get(), transform: [{ translateX: shownBar.get() * LINE - 4 }] }));
  const sheenStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -48 + sheen.get() * (shownBar.get() * LINE + 48) }] }));

  // Development-only QA hook: what the making shows right now.
  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as Record<string, unknown>).__making = { state: () => ({ line, stage: shown.current.stage, target: target.current, ready, made: made?.id ?? null, local }), play: () => { if (ready) onPlay(); } };
  });

  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    {renderOrb && <View pointerEvents="none" style={{ position: 'absolute', top: layout.centerY - layout.size / 2, left: (width - layout.size) / 2 }}>
      <LiquidOrb size={layout.size} radius={layout.sphere} look={orb.look} level={orb.level} touch={orb.touch} />
    </View>}

    {!ready && <Animated.View exiting={FadeOut.duration(300)} style={{ position: 'absolute', top: statusTop, left: 30, right: 30, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, letterSpacing: 2.6, color: k.quiet }}>MAKING YOUR MEDITATION</Text>
      <View style={{ height: 34, alignSelf: 'stretch', marginTop: 12 }}>
        <Animated.Text key={line} entering={FadeIn.delay(120).duration(640)} exiting={FadeOut.duration(260)} numberOfLines={1} adjustsFontSizeToFit
          style={{ position: 'absolute', left: 0, right: 0, fontFamily: THIN, fontSize: 25, lineHeight: 32, letterSpacing: -0.2, color: k.ink, textAlign: 'center' }}>
          {line}
        </Animated.Text>
      </View>
      <View style={{ width: LINE, height: 8, marginTop: 19, justifyContent: 'center' }}>
        <View style={{ height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 1, backgroundColor: withAlpha(voice.accent, 0.9), overflow: 'hidden' }, fill]}>
            <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: 48 }, sheenStyle]}>
              <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </Animated.View>
        </View>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: withAlpha(voice.accent, 1),
          shadowColor: voice.accent, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }, tipStyle]} />
      </View>
    </Animated.View>}

    {ready && <View style={{ position: 'absolute', top: statusTop - 4, left: 30, right: 30, alignItems: 'center' }}>
      <Animated.Text entering={FadeIn.duration(500)} style={{ fontSize: 11, letterSpacing: 2.6, color: voice.accent }}>{firstRun ? 'YOUR FIRST MEDITATION' : 'YOUR MEDITATION'}</Animated.Text>
      <Animated.Text entering={FadeInDown.delay(120).duration(700)} accessibilityRole="header" lineBreakStrategyIOS="push-out"
        style={{ fontFamily: THIN, fontSize: 38, lineHeight: 44, letterSpacing: -0.4, color: k.ink, textAlign: 'center', marginTop: 10 }}>
        {title}
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(260).duration(700)} style={{ fontFamily: REGULAR, fontSize: 16, lineHeight: 23, color: k.secondary, textAlign: 'center', marginTop: 12 }}>
        {description}
      </Animated.Text>
      <Animated.View entering={FadeIn.delay(420).duration(600)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <Text style={{ fontSize: 13, color: k.body }}>{meditation.minutes} min</Text>
        <View style={styles.dot} />
        <Text style={{ fontSize: 13, color: k.body }}>{voice.name}</Text>
        <View style={styles.dot} />
        <Text style={{ fontSize: 13, color: k.body }}>{voice.bed}</Text>
      </Animated.View>
    </View>}

    {ready && <Animated.View entering={rise(reduced ? 0 : 560)} style={{ position: 'absolute', left: Math.max(24, (width - 440) / 2), right: Math.max(24, (width - 440) / 2), bottom: bottom + 10, gap: 12 }}>
      <GlassButton icon="play.fill" label={firstRun && !made ? 'Play the preview' : 'Listen now'} tint={withAlpha(voice.accent, 0.9)} appear={reduced ? 0 : 560} onPress={() => { touch.medium(); onPlay(); }} />
      <Animated.Text entering={FadeIn.delay(reduced ? 0 : 800).duration(500)} style={{ fontSize: 12, color: k.faint, textAlign: 'center' }}>{note}</Animated.Text>
    </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#5A5A60' },
});
