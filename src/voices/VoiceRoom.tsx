import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDuo, useFrameSize } from '../layout/Duo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, interpolate, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Line, Path } from 'react-native-svg';
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { KEEP_SESSION } from '../audioSession';
import { Text } from '../Text';
import { touch } from '../haptics';
import { GlassButton, GlassCircle } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import type { OrbControls } from '../orb/palette';
import { tapOrb } from '../orb/palette';
import LiquidOrb, { LiquidStill } from '../orb/LiquidOrb';
import { lookValues, morphLooks } from '../orb/liquid';
import { ENVELOPE_RATE, voiceById, voices, type Voice, type VoiceId } from './voices';
import { useEnvelope } from './useEnvelope';
import { k, withAlpha } from '../theme';
import { rise } from '../ui/motion';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const THIN = Platform.select({ ios: 'AvenirNext-UltraLight', default: undefined });
const REGULAR = Platform.select({ ios: 'AvenirNext-Regular', default: undefined });
export const ROOM_TINT = 0.92;

// The dial: voices sit on a great wheel whose centre is below the screen, like
// the numbers on a safe. Turning it carries them along the arc, down-left and
// down-right; the one under the index at twelve o'clock is chosen.
const SPACING = 22;               // degrees between voices
const TICKS = 8;                  // fine ticks between two voices
const TICK = SPACING / TICKS;
const DOT = 66;                   // a voice's orb at the index
const rad = (deg: number) => { 'worklet'; return (deg * Math.PI) / 180; };

// Where everything sits. The orb is shared with the conversation, which glides
// its own orb here, so both agree on one centre and one size.
// `aside` (iPhone Duo, open): the orb lives on the other page, so the names start near the
// top of this one and the dial and the button share what is left.
// iPhone Duo: `tight` is the closed display (678 tall, shorter than any phone this was
// made for), so the orb is a little smaller and everything sits closer; `aside` is an open
// page with the orb on the other page. A short aside page (the bottom half in portrait)
// drops the Listen row (tapping the orb listens) and the dial's note.
export function voiceRoomLayout(width: number, height: number, top: number, bottom = 34, aside = false, tight = false) {
  const size = tight ? Math.min(width * 0.92, height * 0.34, 380) : Math.min(width * 0.92, height * 0.4, 380);
  const frame = size * 0.72;
  const centerY = top + (tight ? 34 : 50) + size / 2;
  const sphere = frame * 0.418;
  const radius = Math.max(220, Math.min(300, width * 0.68));
  if (aside) {
    const avail = height - top - bottom, roomy = avail > 560;
    const nameTop = top + (roomy ? Math.max(64, avail * 0.2) : 48);
    const listenTop = roomy ? nameTop + 92 : -1000;
    const buttonTop = height - bottom - (roomy ? 96 : 76);
    const dialTop = roomy ? Math.min(buttonTop - 96, listenTop + 118) : Math.min(nameTop + 166, buttonTop - 70);
    return { size, frame, centerY, sphere, nameTop, listenTop, buttonTop, radius, dialTop, dialCenter: dialTop + radius, listen: roomy, note: roomy };
  }
  const nameTop = centerY + sphere + (tight ? 16 : 22);
  const listenTop = nameTop + (tight ? 84 : 92);
  const buttonTop = height - bottom - 96;
  // The wheel's radius and the height of its crown follow the room that's left.
  const dialTop = tight ? Math.min(buttonTop - 80, listenTop + 132) : Math.min(buttonTop - 96, listenTop + 118);
  return { size, frame, centerY, sphere, nameTop, listenTop, buttonTop, radius, dialTop, dialCenter: dialTop + radius, listen: true, note: true };
}

function Name({ voice, index, position }: { voice: Voice; index: number; position: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const d = index - position.get();
    return { opacity: interpolate(Math.abs(d), [0, 0.42], [1, 0], 'clamp'), transform: [{ translateX: d * 90 }] };
  });
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', gap: 2 }, style]}>
    <Text style={{ fontFamily: THIN, fontSize: 54, lineHeight: 62, letterSpacing: 0.5, color: k.ink, textShadowColor: voice.accent, textShadowRadius: 26 }}>{voice.name}</Text>
    <Text style={{ fontFamily: REGULAR, fontSize: 16, letterSpacing: 0.2, color: k.secondary }}>{voice.line}</Text>
  </Animated.View>;
}

// One voice on the wheel: it rides the arc, and grows and brightens as it reaches the index.
function Seat({ voice, index, position, cx, cy, radius }: { voice: Voice; index: number; position: SharedValue<number>; cx: number; cy: number; radius: number }) {
  const style = useAnimatedStyle(() => {
    const deg = (index - position.get()) * SPACING;
    const a = Math.abs(deg);
    const scale = interpolate(a, [0, SPACING, SPACING * 2.2], [1, 0.72, 0.58], 'clamp');
    return {
      opacity: interpolate(a, [0, SPACING * 0.5, SPACING, SPACING * 2.4], [1, 0.82, 0.55, 0], 'clamp'),
      transform: [{ translateX: cx + radius * Math.sin(rad(deg)) - DOT / 2 }, { translateY: cy - radius * Math.cos(rad(deg)) - DOT / 2 }, { scale }],
    };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: DOT, height: DOT }, style]}>
    <LiquidStill size={DOT} radius={DOT * 0.44} look={voice.look} />
  </Animated.View>;
}

// The rim: fine ticks every few degrees, a longer one at each voice. It turns with the
// voices, and only exists where there are voices: past the first and the last it fades
// out instead of running on around an empty wheel .
const TAIL = 10;          // degrees the rim fades out beyond the first and last voice
function Rim({ cx, cy, radius, count, position }: { cx: number; cy: number; radius: number; count: number; position: SharedValue<number> }) {
  const r = radius + 48, box = r * 2 + 60;
  const span = (count - 1) * SPACING;
  const { ticks, arcs } = useMemo(() => {
    const o = box / 2;
    const at = (deg: number, rr: number) => ({ x: o + Math.sin(rad(deg)) * rr, y: o - Math.cos(rad(deg)) * rr });
    // How visible the rim is at an angle: full across the voices, fading beyond them.
    const reach = (deg: number) => deg < 0 ? Math.max(0, 1 + deg / TAIL) : deg > span ? Math.max(0, 1 - (deg - span) / TAIL) : 1;
    const ticks: { x1: number; y1: number; x2: number; y2: number; major: boolean; alpha: number }[] = [];
    const first = -Math.floor(TAIL / TICK), last = (count - 1) * TICKS + Math.floor(TAIL / TICK);
    for (let t = first; t <= last; t++) {
      const deg = t * TICK, major = t % TICKS === 0 && t >= 0 && t <= (count - 1) * TICKS;
      const len = major ? 13 : t % (TICKS / 2) === 0 ? 8 : 5;
      const a = at(deg, r), b = at(deg, r - len);
      ticks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, major, alpha: reach(deg) });
    }
    // The two rings as short arcs, each as bright as the rim is there.
    const arcs: { d: string; alpha: number; ring: number }[] = [];
    for (const ring of [radius, r + 6]) {
      for (let deg = -TAIL; deg < span + TAIL; deg += 2) {
        const a = at(deg, ring), b = at(Math.min(deg + 2.2, span + TAIL), ring);
        arcs.push({ d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${ring} ${ring} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`, alpha: reach(deg + 1), ring });
      }
    }
    return { ticks, arcs };
  }, [count, r, box, radius, span]);
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${-position.get() * SPACING}deg` }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: cx - box / 2, top: cy - box / 2, width: box, height: box }, turn]}>
    <Svg width={box} height={box}>
      {arcs.map((a, i) => <Path key={`a${i}`} d={a.d} fill="none" stroke="#FFFFFF" strokeWidth={1} strokeOpacity={(a.ring === radius ? 0.07 : 0.1) * a.alpha} />)}
      {ticks.map((t, i) => <Line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} strokeLinecap="round"
        stroke={t.major ? '#ECE9E2' : '#FFFFFF'} strokeOpacity={(t.major ? 0.72 : 0.2) * t.alpha} strokeWidth={t.major ? 1.4 : 1} />)}
    </Svg>
  </Animated.View>;
}

type Props = {
  orb: OrbControls;                          // the orb this room colours and animates
  renderOrb?: boolean;                       // false when the caller already draws that orb in place
  initial?: string;
  onChoose: (voice: Voice) => void;
  onAudition?: (playing: boolean) => void;   // lets the caller hush its own music
  onClose?: () => void;
  reduced: boolean;
  enterDelay?: number;                       // ms before the room's words arrive around the orb
  frame?: { width: number; height: number; top: number; bottom?: number }; // the phone frame on desktop web, or the iPhone Duo page
  aside?: boolean;                           // iPhone Duo, open: the orb is on the other page
  leaving?: boolean;                         // a voice was chosen: the room recedes, the orb stays
  chooseLabel?: (voice: Voice) => string;
};

// The voice room. One orb takes on each voice's colour and speaks in it, its silk
// lifting with the voice. Turn the dial anywhere on the screen; the voice under the
// index is the one you'd choose. Each voice starts on its own 0.6 s after the dial
// rests on it, fading in (Dan: no pressing play); the one it leaves fades out, so two
// never overlap. Pausing keeps the room quiet until you ask to listen again.
export default function VoiceRoom({ orb, renderOrb = true, initial = 'brittney', onChoose, onAudition, onClose, reduced, enterDelay = 0, frame, aside = false, leaving = false, chooseLabel }: Props) {
  const window = useFrameSize();
  const insets = useSafeAreaInsets();
  const width = frame?.width ?? window.width, height = frame?.height ?? window.height, top = frame?.top ?? insets.top;
  const bottom = frame?.bottom ?? (frame ? 16 : insets.bottom);
  const duoLayout = useDuo();
  const layout = voiceRoomLayout(width, height, top, bottom, aside, duoLayout.duo && !aside);
  const list = voices;
  const [index, setIndex] = useState(Math.max(0, list.findIndex(v => v.id === initial)));
  const voice = list[index] ?? list[0];

  // One player per voice, preloaded, so switching is instant.
  const players: Record<VoiceId, AudioPlayer> = {
    brittney: useAudioPlayer(voiceById('brittney').audition, KEEP_SESSION), natasha: useAudioPlayer(voiceById('natasha').audition, KEEP_SESSION),
    brad: useAudioPlayer(voiceById('brad').audition, KEEP_SESSION), jerry: useAudioPlayer(voiceById('jerry').audition, KEEP_SESSION),
  };
  const [playing, setPlaying] = useState<VoiceId | null>(null);
  const sounding = useRef<VoiceId | null>(null);   // audible right now (state lags a render)
  const auto = useRef(true);                        // voices start by themselves until paused
  const soon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fades = useRef(new Map<VoiceId, ReturnType<typeof setInterval>>());
  const envelope = useEnvelope(voices.map(v => v.envelope.audition), ENVELOPE_RATE, orb);

  // The dial's position, in voices: 0 is the first under the index, 1.5 halfway to the third.
  const position = useSharedValue(index);
  // The orb becomes each voice's own orb as the dial passes it, morphing between neighbours.
  const lookList = useMemo(() => list.map(v => lookValues(v.look)), [list]);
  useAnimatedReaction(() => position.get(), p => {
    const clamped = Math.max(0, Math.min(lookList.length - 1, p));
    const i = Math.floor(clamped), j = Math.min(lookList.length - 1, i + 1);
    orb.look.set(morphLooks(lookList[i], lookList[j], clamped - i, 0.35));
  }, [lookList]);

  const chrome = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    chrome.set(withDelay(reduced ? 0 : enterDelay + 300, withTiming(1, { duration: reduced ? 0 : 900, easing: EASE })));
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    // The first voice begins once the room has settled around the orb.
    playSoon(index, (reduced ? 0 : enterDelay) + 900);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    chrome.set(withTiming(0, { duration: 420, easing: EASE }));
    auto.current = false;
    stopAll();
  }, [leaving]);

  useEffect(() => {
    const subs = voices.map(v => players[v.id].addListener('playbackStatusUpdate', status => {
      if (!status.didJustFinish) return;
      if (sounding.current === v.id) sounding.current = null;
      envelope.stop(false);
      setPlaying(p => (p === v.id ? null : p));
    }));
    return () => {
      subs.forEach(s => s.remove());
      if (soon.current) clearTimeout(soon.current);
      fades.current.forEach(timer => clearInterval(timer));
      voices.forEach(v => { try { players[v.id].pause(); } catch {} });
      envelope.stop();
    };
  }, []);
  useEffect(() => { onAudition?.(playing !== null); }, [playing]);

  // A voice's volume glides instead of jumping: in as it starts, out as the dial leaves it.
  const glide = (id: VoiceId, to: number, ms: number, then?: () => void) => {
    const player = players[id];
    clearInterval(fades.current.get(id));
    let from = to;
    try { from = player.volume; } catch {}
    const began = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - began) / ms);
      let ok = true;
      try { player.volume = from + (to - from) * (1 - (1 - t) * (1 - t)); } catch { ok = false; }
      if (t < 1 && ok) return;
      clearInterval(timer);
      fades.current.delete(id);
      if (ok) then?.();
    }, 30);
    fades.current.set(id, timer);
  };
  const silence = (id: VoiceId) => glide(id, 0, 240, () => { try { players[id].pause(); } catch {} });
  const stopAll = () => {
    if (soon.current) { clearTimeout(soon.current); soon.current = null; }
    const id = sounding.current;
    sounding.current = null;
    if (id) silence(id);
    envelope.stop();
    setPlaying(null);
  };
  const play = (v: Voice) => {
    if (soon.current) { clearTimeout(soon.current); soon.current = null; }
    const was = sounding.current;
    if (was && was !== v.id) silence(was);
    const player = players[v.id];
    clearInterval(fades.current.get(v.id));
    try {
      void player.seekTo(0);
      player.volume = 0;
      player.play();
    } catch { return; }
    glide(v.id, 1, 700);
    sounding.current = v.id;
    envelope.start(voices.findIndex(o => o.id === v.id), 0);
    setPlaying(v.id);
  };
  // A moment after the dial comes to rest on a voice, it starts on its own.
  const playSoon = (i: number, ms: number) => {
    if (soon.current) clearTimeout(soon.current);
    soon.current = setTimeout(() => {
      soon.current = null;
      if (auto.current && current.current === i && list[i]) play(list[i]);
    }, ms);
  };
  const toggle = () => {
    if (playing === voice.id) { auto.current = false; stopAll(); touch.light(); return; }
    auto.current = true;
    play(voice);
    touch.soft();
  };

  // The voice under the index changes as the dial passes it; the audition waits
  // until the dial comes to rest there.
  const current = useRef(index);
  const arrive = (i: number) => {
    if (i === current.current || !list[i]) return;
    current.current = i;
    setIndex(i);
    stopAll();
  };
  const rest = (i: number) => {
    arrive(i);
    if (auto.current && list[i] && sounding.current !== list[i].id) playSoon(i, 600);
  };

  const last = list.length - 1;
  const perVoice = layout.radius * rad(SPACING);   // finger travel for one voice: the orbs follow the finger
  const start = useSharedValue(0);
  const settleTo = (target: number, velocity = 0) => {
    'worklet';
    position.set(withSpring(target, reduced ? { duration: 200, dampingRatio: 1 } : { duration: 520, dampingRatio: 0.82, velocity }, finished => {
      if (finished) scheduleOnRN(rest, target);
    }));
  };
  const pan = Gesture.Pan().activeOffsetX([-8, 8]).failOffsetY([-24, 24])
    .onBegin(() => { cancelAnimation(position); start.set(position.get()); })
    .onUpdate(e => {
      const raw = start.get() - e.translationX / perVoice;
      // Past either end the dial resists, like a stop.
      position.set(raw < 0 ? raw * 0.28 : raw > last ? last + (raw - last) * 0.28 : raw);
    })
    .onEnd(e => {
      const v = -e.velocityX / perVoice;
      const target = Math.max(0, Math.min(last, Math.round(position.get() + v * 0.22)));
      settleTo(target, v);
    });

  // The feel of a safe: a fine click for every tick under the index, a firmer
  // detent as each voice arrives.
  useAnimatedReaction(() => Math.round(position.get() * TICKS), (now, before) => {
    if (before === null || now === before) return;
    if (now % TICKS === 0) scheduleOnRN(touch.rigid); else scheduleOnRN(touch.tick);
  });
  useAnimatedReaction(() => Math.max(0, Math.min(last, Math.round(position.get()))), (now, before) => {
    if (before !== null && now !== before) scheduleOnRN(arrive, now);
  });

  const goTo = (i: number) => {
    const target = Math.max(0, Math.min(last, i));
    position.set(withSpring(target, { duration: reduced ? 200 : 650, dampingRatio: 0.86 }, finished => { if (finished) scheduleOnRN(rest, target); }));
  };

  const head = useAnimatedStyle(() => ({ opacity: chrome.get(), transform: [{ translateY: interpolate(chrome.get(), [0, 1], [-8, 0]) }] }));
  const names = useAnimatedStyle(() => ({ opacity: interpolate(chrome.get(), [0.1, 1], [0, 1], 'clamp'), transform: [{ translateY: interpolate(chrome.get(), [0.1, 1], [14, 0], 'clamp') }] }));
  const dial = useAnimatedStyle(() => ({ opacity: interpolate(chrome.get(), [0.25, 1], [0, 1], 'clamp'), transform: [{ translateY: interpolate(chrome.get(), [0.25, 1], [40, 0], 'clamp') }] }));
  const isPlaying = playing === voice.id;

  // Development-only QA hook.
  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as Record<string, unknown>).__voices = { go: goTo, toggle, turn: (p: number) => position.set(p), state: () => ({ index, voice: voice.id, playing, level: orb.level.get(), progress: orb.progress.get() }), level: (v: number) => orb.level.set(v), tap: (x = layout.sphere, y = layout.sphere) => tapOrb(orb.touch, x, y, layout.sphere), choose: () => onChoose(voice) };
  });

  const g = reduced ? 0 : enterDelay;
  const cx = width / 2, cy = layout.dialCenter;
  return <GestureDetector gesture={pan}>
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents={leaving ? 'none' : 'auto'}>
      {renderOrb && <View pointerEvents="none" style={{ position: 'absolute', top: layout.centerY - layout.size / 2, left: (width - layout.size) / 2 }}>
        <LiquidOrb size={layout.size} radius={layout.sphere} look={orb.look} level={orb.level} touch={orb.touch} />
      </View>}
      {!aside && <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? `Pause ${voice.name}` : `Listen to ${voice.name}`} onPress={toggle}
        onPressIn={e => tapOrb(orb.touch, e.nativeEvent.locationX, e.nativeEvent.locationY, layout.sphere)}
        style={{ position: 'absolute', top: layout.centerY - layout.sphere, left: cx - layout.sphere, width: layout.sphere * 2, height: layout.sphere * 2, borderRadius: layout.sphere }} />}

      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: top + 8, left: 0, right: 0, alignItems: 'center', gap: 6 }, head]}>
        <Text style={{ fontSize: 11, letterSpacing: 2.6, color: k.secondary }}>CHOOSE A VOICE</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="headphones" size={13} color={k.faint} />
          <Text style={{ fontSize: 12, color: k.faint }}>Best with headphones</Text>
        </View>
      </Animated.View>
      {onClose && <View style={{ position: 'absolute', left: 16, top: top + 6 }}>
        <GlassCircle icon="xmark" label="Close" color={k.secondary} appear={g + 300} hidden={leaving} onPress={() => { stopAll(); onClose(); }} />
      </View>}

      <Animated.View style={[{ position: 'absolute', top: layout.nameTop, left: 0, right: 0, height: 88 }, names]}
        accessible accessibilityRole="adjustable" accessibilityLabel="Voice" accessibilityValue={{ text: `${voice.name}, ${voice.line}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => goTo(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}>
        {list.map((v, i) => <Name key={v.id} voice={v} index={i} position={position} />)}
      </Animated.View>
      {layout.listen && <Animated.View style={[{ position: 'absolute', top: layout.listenTop, left: 0, right: 0, alignItems: 'center' }, names]}>
        <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? `Pause ${voice.name}` : `Listen to ${voice.name}`} onPress={toggle} hitSlop={10}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 36 }, pressed && { opacity: 0.55 }]}>
          <Icon name={isPlaying ? 'pause.fill' : 'play.fill'} size={13} color={k.ink} />
          <Text style={{ fontSize: 15, color: k.ink }}>{isPlaying ? 'Listening' : 'Listen'}</Text>
        </Pressable>
      </Animated.View>}

      {/* The dial. The index is fixed at twelve o'clock; everything else turns. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, dial]}>
        <Rim cx={cx} cy={cy} radius={layout.radius} count={list.length} position={position} />
        <View style={{ position: 'absolute', left: cx - 1, top: cy - layout.radius - 72, width: 2, height: 12, borderRadius: 1, backgroundColor: k.ink }} />
        {list.map((v, i) => <Seat key={v.id} voice={v} index={i} position={position} cx={cx} cy={cy} radius={layout.radius} />)}
        {/* iPhone Duo, open: the wheel runs past the page, so its ends melt into the dark
            instead of stopping at a hard edge beside the fold or the system strip. */}
        {aside && <>
          <LinearGradient pointerEvents="none" colors={['#000', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 44 }} />
          <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', '#000']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 44 }} />
        </>}
      </Animated.View>

      <Animated.View entering={rise(g + 700)} style={{ position: 'absolute', left: Math.max(24, (width - 440) / 2), right: Math.max(24, (width - 440) / 2), bottom: bottom + 10, gap: 12 }}>
        <GlassButton label={chooseLabel ? chooseLabel(voice) : `Choose ${voice.name}`} tint={withAlpha(voice.accent, 0.9)} appear={g + 700} hidden={leaving}
          onPress={() => { auto.current = false; stopAll(); touch.success(); onChoose(voice); }} />
        {layout.note && <Animated.Text style={[{ fontSize: 12, color: k.faint, textAlign: 'center' }, dial]}>Turn the dial to hear the others. You can change it anytime.</Animated.Text>}
      </Animated.View>
    </View>
  </GestureDetector>;
}
