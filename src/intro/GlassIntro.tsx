import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle, useFrameCallback, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import Svg, { Path } from 'react-native-svg';
import GlassCanvas from './GlassCanvas';
import { clamp, dragDistance, rubberBand, shouldEnter, smooth, type Placement } from './choreography';
import { Text } from '../Text';
import type { HapticMoment } from '../hapticFeedback';
import type { WelcomeWords } from './types';
import { touch } from '../haptics';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// A tap has no momentum to hand over, so the glass glides: a soft start, a long settle.
const GLIDE = Easing.bezier(0.45, 0, 0.2, 1);
const WORDMARK = Platform.select({ ios: 'AvenirNext-Regular', android: 'sans-serif-light', default: "'Avenir Next', Avenir, -apple-system, BlinkMacSystemFont, sans-serif" });
const BODY = Platform.select({ ios: 'AvenirNext-Regular', default: "'Avenir Next', Avenir, -apple-system, BlinkMacSystemFont, sans-serif" });

type Props = {
  width: number;
  height: number;
  target: Placement;      // Kokoro's orb's place above the conversation
  rest?: Placement | null; // iPhone Duo: where the dome rests in this pose
  words?: WelcomeWords | null; // iPhone Duo: the page the wordmark and invitation sit on
  progress: SharedValue<number>; // the lift, 0 → 1; the live orb rides it to the hand-off
  reduced: boolean;
  onCommit: () => void;   // the person chose to enter: sound may begin
  onArrive: () => void;   // the glass has become the orb: reveal what follows
  onDone: () => void;     // the welcome has faded; unmount it
  feel: (moment: HapticMoment) => void;
};

// Screen 0. The approved v3 welcome: a glass horizon under a sparse night sky.
// Pulling it up lifts the glass free; in one unbroken move it contracts, lights up
// with Ember and lands exactly where Kokoro's orb lives above the conversation.
export default function GlassIntro({ width, height, target, rest, words: page, progress, reduced, onCommit, onArrive, onDone }: Props) {
  const contactX = useSharedValue(width / 2);
  const contactY = useSharedValue(height);
  const contactForce = useSharedValue(0);
  const stretch = useSharedValue(0);
  const appear = useSharedValue(reduced ? 1 : 0);
  const words = useSharedValue(reduced ? 1 : 0);
  const tagline = useSharedValue(reduced ? 1 : 0);
  const invite = useSharedValue(reduced ? 1 : 0);
  const fade = useSharedValue(1);
  const committed = useSharedValue(false);
  const arrived = useSharedValue(false);
  const holding = useSharedValue(false);
  const nextBeat = useSharedValue(0);
  const grabbedAt = useSharedValue(0);
  const lastProgress = useSharedValue(0);
  const velocity = useSharedValue(0);
  const drag = dragDistance(width, height, target, rest);

  // First open: night and glass rise out of black, then the words, then the invitation.
  useEffect(() => {
    if (reduced) return;
    appear.set(withTiming(1, { duration: 1400, easing: EASE_OUT }));
    words.set(withDelay(450, withTiming(1, { duration: 900, easing: EASE_OUT })));
    tagline.set(withDelay(800, withTiming(1, { duration: 900, easing: EASE_OUT })));
    invite.set(withDelay(1250, withTiming(1, { duration: 800, easing: EASE_OUT })));
  }, [reduced, appear, words, tagline, invite]);

  // The lift's haptics run on the JS side; the worklets below call these, so they're
  // defined first (a worklet captures what exists when it's created).
  const rev = (h: number) => touch.rev(h);
  const blast = () => touch.blast();

  // Development: frames that took longer than 50 ms during the lift (when, how long,
  // where the glass was), so a stall can be measured instead of guessed.
  const hitches = useSharedValue<number[][]>([]);
  const beats = useSharedValue<number[][]>([]);   // development: when each lift beat fired, and how high
  const dev = __DEV__;
  // A moving glass elongates slightly along its path and settles with a small squash.
  useFrameCallback(frame => {
    if (dev && committed.get() && !arrived.get() && (frame.timeSincePreviousFrame ?? 0) > 50) {
      hitches.set([...hitches.get(), [Math.round(frame.timestamp), Math.round(frame.timeSincePreviousFrame ?? 0), Math.round(progress.get() * 100) / 100]]);
    }
    const dt = Math.max(1 / 240, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const p = progress.get();
    const v = (p - lastProgress.get()) / dt;
    lastProgress.set(p);
    velocity.set(velocity.get() + (v - velocity.get()) * 0.25);
    stretch.set(clamp(velocity.get() * 0.045, -0.06, 0.07));
    // The rev: from the first pull to the landing, beats come faster and hit harder
    // the higher the glass has risen (about 6 a second at the bottom, 28 near the top),
    // then the landing bursts (arrive). Nothing while the glass falls back.
    const revving = !arrived.get() && (committed.get() || (holding.get() && p > 0.02));
    if (revving && frame.timestamp >= nextBeat.get()) {
      const h = clamp(p, 0, 1);
      scheduleOnRN(rev, h);
      if (dev) beats.set([...beats.get(), [Math.round(frame.timestamp), Math.round(h * 100) / 100]]);
      nextBeat.set(frame.timestamp + 34 + 140 * Math.pow(1 - h, 1.3));
    }
  });

  const arrive = () => {
    'worklet';
    if (arrived.get()) return;
    arrived.set(true);
    scheduleOnRN(blast);
    scheduleOnRN(onArrive);
    fade.set(withTiming(0, { duration: reduced ? 320 : 620, easing: EASE_OUT }, finished => {
      if (finished) scheduleOnRN(onDone);
    }));
  };

  // After a pull the finger's speed carries straight into a critically damped spring,
  // so the glass keeps moving exactly as the finger left it and eases into the orb's
  // place without a bounce or a pause; a tap glides the same path on a timing curve.
  const enter = (launch: number | null) => {
    'worklet';
    if (committed.get()) return;
    committed.set(true);
    contactForce.set(withTiming(0, { duration: 220 }));
    scheduleOnRN(onCommit);
    if (reduced) { progress.set(1); arrive(); return; }
    progress.set(launch === null
      ? withTiming(1, { duration: 1500, easing: GLIDE })
      : withSpring(1, { duration: 1150, dampingRatio: 1, velocity: clamp(launch, 0, 6) }));
  };

  // Development-only QA hook: drive the welcome from the debugger when the
  // simulator can't inject touches (scrub to a frame, or enter as a tap would).
  useEffect(() => {
    if (!__DEV__) return;
    const hook = {
      scrub: (p: number) => scheduleOnUI(() => { 'worklet'; cancelAnimation(progress); progress.set(p); }),
      enter: (launch: number | null = null) => scheduleOnUI(enter, launch),
      state: () => ({ reduced, committed: committed.get(), arrived: arrived.get(), progress: progress.get(), hitches: hitches.get(), beats: beats.get() }),
      // As if a finger let go at `p` moving at `v` progress/second.
      release: (p: number, v: number) => scheduleOnUI(() => { 'worklet'; cancelAnimation(progress); progress.set(p); enter(v); }),
    };
    (globalThis as { __kokoroIntro?: typeof hook }).__kokoroIntro = hook;
    return () => {
      (globalThis as { __kokoroIntroLast?: unknown }).__kokoroIntroLast = hook.state();
      delete (globalThis as { __kokoroIntro?: typeof hook }).__kokoroIntro;
    };
  });

  // The glass has become the orb: hand over.
  useAnimatedReaction(() => progress.get(), p => {
    if (committed.get() && p > 0.965) arrive();
  });

  const pan = Gesture.Pan()
    .minDistance(4)
    .onBegin(event => {
      if (committed.get()) return;
      holding.set(true);
      cancelAnimation(progress);
      grabbedAt.set(progress.get());
      contactX.set(event.x);
      contactY.set(event.y);
      contactForce.set(withTiming(1, { duration: 140 }));
    })
    .onUpdate(event => {
      if (committed.get()) return;
      contactX.set(event.x);
      contactY.set(event.y);
      progress.set(rubberBand(grabbedAt.get() - event.translationY / drag));
    })
    .onEnd(event => {
      if (committed.get()) return;
      const v = -event.velocityY / drag;
      if (shouldEnter(progress.get(), v)) { enter(v); return; }
      contactForce.set(withTiming(0, { duration: 220 }));
      progress.set(withSpring(0, { mass: 1, stiffness: 120, damping: 20, velocity: v }));
    })
    .onFinalize((_event, success) => {
      holding.set(false);
      if (committed.get()) return;
      contactForce.set(withTiming(0, { duration: 220 }));
      // The system can take the touch away (the home bar's swipe does); never leave
      // the glass stranded where the finger was: finish the lift or let it fall back.
      if (!success) {
        if (shouldEnter(progress.get(), 0)) enter(0.9);
        else progress.set(withSpring(0, { mass: 1, stiffness: 120, damping: 20 }));
      }
    });
  const tap = Gesture.Tap().maxDuration(450).onEnd((_event, success) => { if (success) enter(null); });
  const gesture = Gesture.Race(pan, tap);

  const wordsStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: words.get() * (1 - smooth(0.03, 0.3, p)), transform: [{ translateY: (1 - words.get()) * 10 - clamp(p, 0, 1) * 48 }] };
  });
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.get() }));
  const inviteStyle = useAnimatedStyle(() => ({
    opacity: invite.get() * (1 - smooth(0, 0.16, progress.get())),
    transform: [{ translateY: (1 - invite.get()) * 8 }],
  }));
  const layerStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  return <Animated.View style={[StyleSheet.absoluteFill, styles.layer, layerStyle]} accessibilityViewIsModal>
    <GlassCanvas width={width} height={height} target={target} rest={rest} reduced={reduced} progress={progress}
      contactX={contactX} contactY={contactY} contactForce={contactForce} stretch={stretch} appear={appear} />
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} collapsable={false}>
        <Animated.View style={[styles.intro, page ? { left: page.x, width: page.w, right: undefined, top: page.top } : { top: height * 0.345 }, wordsStyle]}>
          <Text accessibilityRole="header" style={styles.wordmark} maxFontSizeMultiplier={1.2}>kokoro</Text>
          <Animated.View style={taglineStyle}>
            <Text style={styles.tagline} maxFontSizeMultiplier={1.4}>Meditations made for you{'\n'}and your goals.</Text>
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.invitation, page ? { left: page.x, width: page.w, right: undefined, top: page.invite } : { top: height * 0.878 }, inviteStyle]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Swipe up to enter" accessibilityHint="Enters Kokoro. You can tap, too."
            onPress={() => scheduleOnUI(enter, null)} hitSlop={12} style={styles.enter}>
            <Text style={styles.enterText} maxFontSizeMultiplier={1.4}>Swipe up to enter</Text>
            <Animated.View style={reduced ? undefined : styles.nudge}>
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#ADC6E9" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 19V5M6 11l6-6 6 6" />
              </Svg>
            </Animated.View>
          </Pressable>
          <Text style={styles.enterNote} maxFontSizeMultiplier={1.4}>You can tap, too.</Text>
        </Animated.View>
      </View>
    </GestureDetector>
  </Animated.View>;
}

const styles = StyleSheet.create({
  layer: { zIndex: 30, backgroundColor: '#000' },
  intro: { position: 'absolute', left: 22, right: 22, alignItems: 'center', pointerEvents: 'none' },
  wordmark: { fontFamily: WORDMARK, fontSize: 70, lineHeight: 76, letterSpacing: -4, fontWeight: '400', color: '#EEF1F6', textAlign: 'center' },
  tagline: { fontFamily: BODY, fontSize: 15, lineHeight: 23, letterSpacing: -0.2, color: '#B7BDC8', textAlign: 'center', marginTop: 21 },
  invitation: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  enter: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, paddingHorizontal: 13 },
  enterText: { fontFamily: BODY, fontSize: 14, letterSpacing: -0.15, color: '#F4F6FC' },
  enterNote: { fontFamily: BODY, fontSize: 11, color: '#A8BFDC', marginTop: 2 },
  nudge: {
    animationName: { '0%': { transform: [{ translateY: 0 }] }, '50%': { transform: [{ translateY: -4 }] }, '100%': { transform: [{ translateY: 0 }] } },
    animationDuration: '2.4s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  } as object,
});
