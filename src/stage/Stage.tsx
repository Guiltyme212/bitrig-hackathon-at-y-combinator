import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type TextStyle } from 'react-native';
import { useFrameSize } from '../layout/Duo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FadeMask from './FadeMask';
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Text } from '../Text';
import { rise } from '../ui/motion';
import { touch } from '../haptics';
import { k } from '../theme';

export type Line = { id: string; who: 'kokoro' | 'you'; text: string; spoken?: number };   // spoken: the voice's length in ms

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const glide = LinearTransition.duration(460).easing(EASE);

// How long each character waits before it appears. Punctuation breathes.
function pause(text: string, i: number) {
  const ch = text[i], next = text[i + 1];
  if (/[.!?]/.test(ch) && (next === undefined || next === ' ' || next === '\n')) return 320;
  if (ch === ',' || ch === ';' || ch === ':') return 140;
  if (ch === '—' || ch === '…') return 240;
  return 24;
}

// A line that types itself out. The two leading characters fade in, the rest
// of the line is laid out but invisible, so words never jump between lines.
// Each word lands with a crisp tap; the end of a sentence lands with a soft beat.
// When the line is spoken, the typing is paced to the voice, like live captions.
export function TypedText({ text, color, style, run, instant, spoken, onDone, onWord }: { text: string; color: string; style: TextStyle; run: boolean; instant: boolean; spoken?: number; onDone?: () => void; onWord?: () => void }) {
  const [shown, setShown] = useState(run && !instant ? 0 : text.length);
  const count = useRef(shown), finished = useRef(!run || instant);
  const done = useRef(onDone); done.current = onDone;
  const word = useRef(onWord); word.current = onWord;
  useEffect(() => {
    if (!run || finished.current) return;
    if (instant) { count.current = text.length; setShown(text.length); finished.current = true; done.current?.(); return; }
    let base = 0;
    for (let i = 0; i < text.length; i++) base += pause(text, i);
    const scale = spoken ? Math.max(0.7, Math.min(4, (spoken * 0.9 - 120) / base)) : 1;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const i = count.current;
      if (i >= text.length) { finished.current = true; done.current?.(); return; }
      count.current = i + 1;
      setShown(i + 1);
      const ch = text[i];
      if (/[.!?]/.test(ch) && (i + 1 === text.length || text[i + 1] === ' ')) touch.soft();
      else if (ch !== ' ' && (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n')) { touch.word(); word.current?.(); }
      timer = setTimeout(step, pause(text, i) * scale);
    };
    timer = setTimeout(step, 80);
    return () => clearTimeout(timer);
  }, [run, instant, text, spoken]);
  if (shown >= text.length) return <Text accessibilityLabel={text} style={[style, { color }]}>{text}</Text>;
  const a = Math.max(0, shown - 2), b = Math.max(0, shown - 1);
  return <Text accessibilityLabel={text} style={[style, { color }]}>
    {text.slice(0, a)}
    <Text style={{ color: `${color}AA` }}>{text.slice(a, b)}</Text>
    <Text style={{ color: `${color}48` }}>{text.slice(b, shown)}</Text>
    <Text style={{ color: 'transparent' }}>{text.slice(shown)}</Text>
  </Text>;
}

const ageOpacity = [1, 0.4, 0.2, 0.08, 0];

function ThreadLine({ line, age, typing, instant, browsing, onTyped, onWord }: { line: Line; age: number; typing: boolean; instant: boolean; browsing: boolean; onTyped: (id: string) => void; onWord?: () => void }) {
  const opacity = useSharedValue(1);
  // Older lines recede, but scrolling back brings every one of them up to read.
  useEffect(() => { opacity.set(withTiming(browsing ? 0.92 : ageOpacity[Math.min(age, 4)], { duration: browsing ? 260 : 520, easing: EASE })); }, [age, browsing, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const you = line.who === 'you';
  // The layout animation and the age fade live on separate views so neither overwrites the other.
  return <Animated.View layout={glide} entering={you ? FadeInDown.duration(420).easing(EASE) : FadeIn.duration(160)}>
    <Animated.View style={[{ paddingTop: you ? 2 : 0 }, style]}>
      {you
        ? <Text style={[styles.you]} numberOfLines={3}>{line.text}</Text>
        : <TypedText text={line.text} color={k.ink} style={styles.kokoro} run={typing} instant={instant} spoken={line.spoken} onDone={() => onTyped(line.id)} onWord={onWord} />}
    </Animated.View>
  </Animated.View>;
}

type Props = {
  lines: Line[];
  typingId: string | null;
  onTyped: (id: string) => void;
  dock: React.ReactNode;       // the current way to answer; keyed so it can enter and leave
  dockKey: string;
  top: number;                 // the thread lives below this line (under the orb)
  reduced: boolean;
  hidden?: boolean;            // the voice room takes the whole screen
  height?: number;             // the frame's height when it isn't the window's (desktop web)
  onWord?: () => void;         // each word Kokoro types, for the orb to breathe with
  onSkip?: () => void;         // they tapped to hurry a line along
};

// Opal's conversation, Kokoro's voice: the orb above, lines typing in the middle
// with haptics, your answers echoed in mint, and one way to answer at a time below.
export default function Stage({ lines, typingId, onTyped, dock, dockKey, top, reduced, hidden = false, height: frameHeight, onWord, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const window = useFrameSize();
  const height = frameHeight ?? window.height;
  // A wide page (the iPhone Duo open in portrait) keeps a reading measure; phones are unchanged.
  const inset = Math.max(28, (window.width - 520) / 2), dockInset = Math.max(20, (window.width - 460) / 2);
  const keyboard = useAnimatedKeyboard();
  const dockHeight = useSharedValue(0);
  const [skip, setSkip] = useState<string | null>(null);
  const bottomPad = insets.bottom + 10;
  const visible = useSharedValue(hidden ? 0 : 1);
  useEffect(() => { visible.set(withTiming(hidden ? 0 : 1, { duration: hidden ? 380 : 620, easing: EASE })); }, [hidden, visible]);

  // The newest line rests a little below the middle, and rises above whatever
  // answer is open beneath it, and above the keyboard.
  const rest = height * 0.4;
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, keyboard.height.get() - bottomPad + 10) + (1 - visible.get()) * 40 }] }));
  const thread = useAnimatedStyle(() => {
    const kb = Math.max(0, keyboard.height.get() - bottomPad + 10);
    const raise = Math.max(rest, dockHeight.get() + 30 + kb);
    return { opacity: visible.get(), height: Math.max(80, height - top - raise), transform: [{ translateY: -raise - (1 - visible.get()) * 24 }] };
  });
  // The whole conversation stays: it can be scrolled back to read what Kokoro said
  // (Dan, 26 September: "I can't scroll the text up, maybe I missed something").
  // New lines keep it at the bottom unless they're reading further up.
  const scroller = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const [browsing, setBrowsing] = useState(false);
  const follow = () => { if (atBottom.current) scroller.current?.scrollToEnd({ animated: true }); };
  const skipTyping = () => { if (typingId) { setSkip(typingId); onSkip?.(); } };

  return <View style={StyleSheet.absoluteFill} pointerEvents={hidden ? 'none' : 'box-none'}>
    {/* Tap anywhere above the answer to let Kokoro finish its sentence. */}
    <Pressable accessible={false} onPress={() => { if (typingId) { setSkip(typingId); onSkip?.(); } }} style={[StyleSheet.absoluteFill, { top }]} />
    <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} style={[styles.thread, { left: inset, right: inset }, thread]}>
      {/* Older lines dissolve into the dark before they reach the orb. */}
      <FadeMask fade={0.22}>
        <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}
          scrollEventThrottle={48} onLayout={follow} onContentSizeChange={follow}
          onScroll={e => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const bottom = contentSize.height - layoutMeasurement.height - contentOffset.y < 28;
            atBottom.current = bottom;
            if (bottom === browsing) setBrowsing(!bottom);
          }}>
          <Pressable accessible={false} onPress={skipTyping} style={styles.lines}>
            {lines.map((line, i) => <ThreadLine key={line.id} line={line} age={lines.length - 1 - i} typing={line.id === typingId} browsing={browsing}
              instant={reduced || skip === line.id} onTyped={onTyped} onWord={onWord} />)}
          </Pressable>
        </ScrollView>
      </FadeMask>
    </Animated.View>
    <Animated.View style={[styles.dock, { paddingBottom: bottomPad, paddingHorizontal: dockInset }, lift]}
      onLayout={e => dockHeight.set(withTiming(e.nativeEvent.layout.height, { duration: 420, easing: EASE }))}>
      {/* The answer rises into place; its glass materialises on its own. */}
      <Animated.View key={dockKey} entering={rise(0, 26, 520)}>
        {dock}
      </Animated.View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  thread: { position: 'absolute', left: 28, right: 28, bottom: 0 },
  scroll: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 48 },
  lines: { gap: 16 },
  kokoro: { fontSize: 24, lineHeight: 31, letterSpacing: -0.45, fontWeight: '400', textAlign: 'center' },
  you: { fontSize: 21, lineHeight: 28, letterSpacing: -0.3, color: k.echo, textAlign: 'center' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
});
