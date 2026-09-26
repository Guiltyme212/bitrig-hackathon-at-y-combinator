import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useDuo, useFrameSize } from '../layout/Duo';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, interpolateColor, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming, scrollTo, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, setIsAudioActiveAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { report } from '../devLog';
import { Text } from '../Text';
import { touch } from '../haptics';
import { Glass, GlassButton } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { TextButton } from '../ui/Buttons';
import { defaultFeeling, feelings, minuteChoices, shortcuts, type Feeling } from './script';
import { k } from '../theme';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const THIN = Platform.select({ ios: 'AvenirNext-UltraLight', default: undefined });

// A round mint button that sits inside a glass field: send, or stop.
function RoundAction({ icon, label, onPress, disabled = false, solid = true }: { icon: 'arrow.up' | 'stop.fill' | 'mic.fill'; label: string; onPress: () => void; disabled?: boolean; solid?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={6}
    style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: solid ? k.mint : 'rgba(255,255,255,0.08)', opacity: disabled ? 0.35 : 1 }, pressed && { transform: [{ scale: 0.92 }] }]}>
    <Icon name={icon} size={icon === 'stop.fill' ? 16 : 19} color={solid ? k.mintInk : k.ink} />
  </Pressable>;
}

function GlassField({ trailing, multiline = false, appear = 60, ...input }: TextInputProps & { trailing: React.ReactNode; appear?: number }) {
  return <Glass interactive appear={appear} style={{ borderRadius: 29, minHeight: 58, flexDirection: 'row', alignItems: multiline ? 'flex-end' : 'center', paddingLeft: 22, paddingRight: 7, paddingVertical: 7, gap: 8 }}>
    <TextInput placeholderTextColor="#8C8C92" keyboardAppearance="dark" selectionColor={k.mint} multiline={multiline}
      style={{ flex: 1, color: k.ink, fontSize: 18, lineHeight: 23, paddingTop: multiline ? 10 : 0, paddingBottom: multiline ? 10 : 0, maxHeight: 118 }} {...input} />
    {trailing}
  </Glass>;
}

export function NameDock({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  const send = () => { const value = name.trim(); if (value) onSubmit(value.slice(0, 30)); };
  return <View style={{ gap: 4 }}>
    <GlassField value={name} onChangeText={setName} placeholder="Your first name" autoFocus autoCapitalize="words" autoComplete="given-name"
      returnKeyType="done" onSubmitEditing={send} maxLength={30} accessibilityLabel="Your first name"
      trailing={<RoundAction icon="arrow.up" label="Continue" disabled={!name.trim()} onPress={send} />} />
    <TextButton label="I’d rather not say" onPress={() => onSubmit('')} />
  </View>;
}

// The open question. Talk and Type are offered as equals before anything is asked
// of the phone; shortcuts stay underneath for when words are hard. Choosing Talk is
// the only thing that ever leads to the microphone prompt.
export function MindDock({ onSubmit, onShortcut, onTalk, talk = true, typing: typingFirst = false, disclosure = true, chips = true }: { onSubmit: (text: string) => void; onShortcut: (label: string, feel: Feeling['id']) => void; onTalk: () => void; talk?: boolean; typing?: boolean; disclosure?: boolean; chips?: boolean }) {
  const duo = useDuo().duo;
  const chipRow = shortcuts.map((s, i) => <Glass key={s.label} interactive appear={200 + i * 70} tint="rgba(255,255,255,0.05)" style={{ borderRadius: 21 }}>
    <Pressable accessibilityRole="button" onPress={() => { touch.light(); onShortcut(s.label, s.feel); }} style={{ minHeight: 42, paddingHorizontal: 16, justifyContent: 'center' }}>
      <Text style={{ fontSize: 15, color: k.body }}>{s.label}</Text>
    </Pressable>
  </Glass>);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(typingFirst || !talk);
  const send = () => { const value = text.trim(); if (value) onSubmit(value); };
  return <View style={{ gap: 12 }}>
    {typing
      ? <GlassField appear={60} value={text} onChangeText={setText} placeholder="A few words are enough." multiline autoFocus accessibilityLabel="What’s on your mind"
          returnKeyType="send" submitBehavior="submit" onSubmitEditing={send} maxLength={280}
          trailing={text.trim() || !talk ? <RoundAction icon="arrow.up" label="Send" disabled={!text.trim()} onPress={send} /> : <RoundAction icon="mic.fill" label="Talk instead" solid={false} onPress={onTalk} />} />
      : <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><GlassButton icon="mic.fill" label="Talk" appear={60} onPress={() => { touch.medium(); onTalk(); }} /></View>
          <View style={{ flex: 1 }}><GlassButton icon="keyboard" label="Type" secondary appear={130} onPress={() => { touch.light(); setTyping(true); }} /></View>
        </View>}
    {chips && !duo && <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
      {chipRow}
    </ScrollView>}
    {/* iPhone Duo: the row ends at a page edge beside the fold or the strip, so it melts
        into the dark there instead of stopping on a straight line. */}
    {chips && duo && <View style={{ marginHorizontal: -20 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {chipRow}
      </ScrollView>
      <LinearGradient pointerEvents="none" colors={['#000', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 22 }} />
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', '#000']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 36 }} />
    </View>}
    {!typing && talk && <Text style={{ fontSize: 12, color: k.faint, textAlign: 'center' }}>Talk as quietly as you like.</Text>}
    {disclosure && <Text style={{ fontSize: 11, lineHeight: 16, color: k.faint, textAlign: 'center' }}>Kokoro writes your meditation with AI. Your first one is free.</Text>}
  </View>;
}

export type Heard = { kind: 'clip'; uri: string; seconds: number } | { kind: 'denied' } | { kind: 'error' } | { kind: 'type' };

// Listening. The microphone is asked for only now, after the orb has said when it
// listens. The orb itself moves with your voice (onLevel); here there's only a
// quiet status and a way to finish. It stops by itself after a pause.
// Five soft bars that follow the voice, so they can see that they're being heard.
function VoiceBars({ level, live }: { level: SharedValue<number>; live: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 22, width: 31 }}>
    {[0.45, 0.75, 1, 0.75, 0.45].map((f, i) => <VoiceBar key={i} level={level} weight={f} live={live} />)}
  </View>;
}
function VoiceBar({ level, weight, live }: { level: SharedValue<number>; weight: number; live: boolean }) {
  const style = useAnimatedStyle(() => ({ height: 4 + 18 * Math.min(1, level.get()) * weight, opacity: live ? 1 : 0.35 }));
  return <Animated.View style={[{ width: 3, borderRadius: 1.5, backgroundColor: k.mint }, style]} />;
}

export function ListeningDock({ onHeard, onLevel }: { onHeard: (heard: Heard) => void; onLevel?: (level: number) => void }) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 70);
  const [live, setLive] = useState(false);
  const shown = useSharedValue(0);
  const started = useRef(0), spoke = useRef(0), quiet = useRef(0), done = useRef(false), loudest = useRef(-160);
  const heard = useRef(onHeard); heard.current = onHeard;
  const finish = async (how: 'clip' | 'type') => {
    if (done.current) return;
    done.current = true;
    const seconds = Math.max(1, Math.round((Date.now() - started.current) / 1000));
    try { await recorder.stop(); } catch {}
    onLevel?.(0);
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    touch.light();
    const uri = recorder.uri;
    const long = Date.now() - started.current >= 800;
    report('listen:finish', { how, seconds, spoke: spoke.current > 0, loudest: Math.round(loudest.current), file: !!uri });
    // Any real recording is sent to be written down, and the transcription decides
    // whether there were words: a phone's meter can read low (a soft voice, a noisy
    // room), and trusting it threw away what people had actually said.
    heard.current(how === 'type' ? { kind: 'type' } : uri && long ? { kind: 'clip', uri, seconds } : { kind: 'clip', uri: uri ?? '', seconds: 0 });
  };
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!alive) return;
        report('listen:permission', { granted: permission.granted, status: permission.status });
        if (!permission.granted) { done.current = true; heard.current({ kind: 'denied' }); return; }
        // Switch the phone's audio over to recording and make sure it's live before the
        // recorder prepares: iOS refuses to prepare while the session is still set up
        // for playback (the ambient bed, Kokoro's voice), and the switch can lag a moment.
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'doNotMix' });
        await setIsAudioActiveAsync(true);
        for (let attempt = 0; ; attempt++) {
          try { await recorder.prepareToRecordAsync(); break; }
          catch (error) {
            if (attempt >= 2 || !alive) throw error;
            await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'doNotMix' });
          }
        }
        if (!alive) return;
        recorder.record();
        started.current = Date.now();
        report('listen:started');
        setLive(true);
        touch.soft();
      } catch (error) {
        if (__DEV__) console.warn('Listening: the microphone could not start', error);
        report('listen:error', { message: error instanceof Error ? error.message : String(error) });
        if (alive && !done.current) { done.current = true; heard.current({ kind: 'error' }); }
      }
    })();
    return () => {
      alive = false;
      if (!done.current) { try { recorder.stop().catch(() => {}); } catch {} }
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!live || done.current) return;
    const db = state.metering ?? -160;
    if (db > loudest.current) loudest.current = db;
    const level = Math.max(0, Math.min(1, (db + 52) / 40));
    onLevel?.(level);
    shown.set(withTiming(level, { duration: 90 }));
    const now = Date.now();
    // After they've said something, nearly three seconds of quiet means they've finished:
    // people telling a story pause to think, and a shorter wait cut them off mid-thought.
    // (The arrow finishes at once; a minute is the most one answer can run.)
    if (level > 0.28) { spoke.current = now; quiet.current = 0; }
    else if (spoke.current && !quiet.current) quiet.current = now;
    if (spoke.current && quiet.current && now - quiet.current > 2800) void finish('clip');
    if (now - started.current > 60000) void finish('clip');
  }, [state.metering, state.durationMillis, live]);
  return <View style={{ gap: 6, alignItems: 'center' }}>
    <Glass appear={0} style={{ alignSelf: 'stretch', borderRadius: 29, minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingLeft: 22, paddingRight: 7, gap: 12 }}>
      <VoiceBars level={shown} live={live} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, color: k.ink }} accessibilityLiveRegion="polite">{live ? 'I’m listening' : 'One moment…'}</Text>
        {live && <Text style={{ fontSize: 12, color: k.faint, marginTop: 1 }}>Tap the arrow when you’re done</Text>}
      </View>
      <RoundAction icon="arrow.up" label="Done" disabled={!live} onPress={() => void finish('clip')} />
    </Glass>
    <TextButton label="Type instead" onPress={() => void finish('type')} />
  </View>;
}

// Anima's wheel: the feeling in the middle is lit, the rest recede and tilt away.
// A liquid-glass lens holds the choice; every detent clicks under the finger.
const ROW = 50;
function WheelRow({ index, label, offset, onPress }: { index: number; label: string; offset: SharedValue<number>; onPress: () => void }) {
  const style = useAnimatedStyle(() => {
    const d = (offset.get() - index * ROW) / ROW;
    const a = Math.abs(d);
    return {
      opacity: interpolate(a, [0, 1, 2, 3], [1, 0.42, 0.16, 0.04], 'clamp'),
      transform: [{ perspective: 500 }, { rotateX: `${Math.max(-60, Math.min(60, d * 22))}deg` }, { scale: interpolate(a, [0, 1, 2], [1, 0.9, 0.82], 'clamp') }],
    };
  });
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ height: ROW, justifyContent: 'center' }}>
    <Animated.Text style={[{ fontSize: 22, letterSpacing: -0.3, color: k.ink, textAlign: 'center' }, style]}>{label}</Animated.Text>
  </Pressable>;
}

export function FeelDock({ onSubmit, onChange }: { onSubmit: (feel: Feeling) => void; onChange?: (feel: Feeling) => void }) {
  const ref = useAnimatedRef<Animated.ScrollView>();
  const offset = useSharedValue(defaultFeeling * ROW);
  const [index, setIndex] = useState(defaultFeeling);
  const detent = (i: number) => { touch.tick(); setIndex(i); onChange?.(feelings[i]); };
  useAnimatedReaction(() => Math.max(0, Math.min(feelings.length - 1, Math.round(offset.get() / ROW))), (now, before) => {
    if (before !== null && now !== before) scheduleOnRN(detent, now);
  });
  const onScroll = useAnimatedScrollHandler(e => { offset.set(e.contentOffset.y); });
  const jump = (i: number, animated = true) => scheduleOnUI(() => { 'worklet'; scrollTo(ref, 0, i * ROW, animated); });
  // The browser ignores contentOffset, so the wheel is placed on its default after layout.
  useEffect(() => { if (process.env.EXPO_OS === 'web') setTimeout(() => jump(defaultFeeling, false), 0); }, []);
  const glow = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(offset.get() / ROW, feelings.map((_, i) => i), feelings.map(f => `${f.color}30`)),
  }));
  return <View style={{ gap: 14 }}>
    <View style={{ height: ROW * 5, justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 24, right: 24, height: ROW - 4, borderRadius: (ROW - 4) / 2 }, glow]} />
      <Glass appear={80} style={{ position: 'absolute', left: 24, right: 24, height: ROW - 4, borderRadius: (ROW - 4) / 2 }} />
      <Animated.ScrollView ref={ref} onScroll={onScroll} scrollEventThrottle={16} snapToInterval={ROW} decelerationRate="fast"
        showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: ROW * 2 }} style={StyleSheet.absoluteFill} contentOffset={{ x: 0, y: defaultFeeling * ROW }}
        accessibilityRole="adjustable" accessibilityLabel="How you want to feel" accessibilityValue={{ text: feelings[index].label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => jump(Math.max(0, Math.min(feelings.length - 1, index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}>
        {feelings.map((f, i) => <WheelRow key={f.id} index={i} label={f.label} offset={offset} onPress={() => jump(i)} />)}
      </Animated.ScrollView>
    </View>
    <GlassButton appear={200} label="Continue" onPress={() => { touch.light(); onSubmit(feelings[index]); }} />
  </View>;
}

// The numeral rolls like an odometer; the glass track has a detent at each choice.
function Numeral({ value, direction }: { value: number; direction: number }) {
  const roll = (from: number) => () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: from }] },
      animations: { opacity: withTiming(1, { duration: 260 }), transform: [{ translateY: withSpring(0, { duration: 520, dampingRatio: 0.72 }) }] },
    };
  };
  const out = (to: number) => () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
      animations: { opacity: withTiming(0, { duration: 200 }), transform: [{ translateY: withTiming(to, { duration: 320, easing: EASE }) }] },
    };
  };
  // Tall enough for Avenir's thin ascender: a line height shorter than the glyph clips its top.
  return <View style={{ height: 150, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
    <Animated.Text key={value} entering={roll(direction * 70)} exiting={out(-direction * 70)}
      style={{ position: 'absolute', fontFamily: THIN, fontSize: 106, color: k.ink, textShadowColor: 'rgba(236,233,226,0.55)', textShadowRadius: 22, fontVariant: ['tabular-nums'] }}>
      {value}
    </Animated.Text>
  </View>;
}

export function TimeDock({ onSubmit }: { onSubmit: (minutes: number) => void }) {
  const { width } = useFrameSize();
  const track = Math.min(width - 40, 360), segment = track / minuteChoices.length;
  // Kokoro asks "5 or 10 minutes?", and five is the length that starts being made early.
  const [index, setIndex] = useState(2);
  const [direction, setDirection] = useState(1);
  const x = useSharedValue(segment * 2);
  const current = useSharedValue(2);
  const choose = (i: number) => { setDirection(i >= index ? 1 : -1); setIndex(i); touch.tick(); };
  useAnimatedReaction(() => Math.max(0, Math.min(minuteChoices.length - 1, Math.round(x.get() / segment))), (now, before) => {
    if (before !== null && now !== before) { current.set(now); scheduleOnRN(choose, now); }
  });
  const settle = (i: number) => { 'worklet'; x.set(withSpring(i * segment, { duration: 420, dampingRatio: 0.78 })); };
  const pan = Gesture.Pan().activeOffsetX([-4, 4])
    .onChange(e => { x.set(Math.max(0, Math.min(segment * (minuteChoices.length - 1), x.get() + e.changeX))); })
    .onEnd(() => { settle(Math.round(x.get() / segment)); });
  const tap = Gesture.Tap().onEnd(e => { settle(Math.max(0, Math.min(minuteChoices.length - 1, Math.floor(e.x / segment)))); });
  const lens = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const minutes = minuteChoices[index];
  return <View style={{ gap: 16, alignItems: 'center' }}>
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        <View style={{ width: 150 }}><Numeral value={minutes} direction={direction} /></View>
      </View>
      <Text style={{ fontSize: 12, letterSpacing: 2, color: k.secondary, marginTop: -14 }}>{minutes === 1 ? 'MINUTE' : 'MINUTES'} OF LISTENING</Text>
    </View>
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Glass interactive appear={100} style={{ width: track, height: 54, borderRadius: 27, flexDirection: 'row', overflow: 'hidden' }}>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 5, left: 5, width: segment - 10, height: 44, borderRadius: 22, backgroundColor: 'rgba(236,233,226,0.9)' }, lens]} />
        {minuteChoices.map((m, i) => <View key={m} accessibilityRole="button" accessibilityLabel={`${m} ${m === 1 ? 'minute' : 'minutes'}`} accessibilityState={{ selected: i === index }}
          style={{ width: segment, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: i === index ? '600' : '400', color: i === index ? k.mintInk : k.body, fontVariant: ['tabular-nums'] }}>{m} min</Text>
        </View>)}
      </Glass>
    </GestureDetector>
    <View style={{ alignSelf: 'stretch' }}><GlassButton appear={220} label="Continue" onPress={() => { touch.light(); onSubmit(minutes); }} /></View>
  </View>;
}
