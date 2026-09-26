import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createHapticFeedback } from './hapticFeedback';

export const feel = createHapticFeedback({
  available: () => Platform.OS !== 'web' && AppState.currentState === 'active',
  play: async moment => {
    if (Platform.OS === 'android') {
      await Haptics.performAndroidHapticsAsync(
        moment === 'select'
          ? Haptics.AndroidHaptics.Segment_Frequent_Tick
          : Haptics.AndroidHaptics.Gesture_End,
      );
    } else if (moment === 'select') {
      await Haptics.selectionAsync();
    } else {
      // Even completion is one soft impact, without a notification fanfare.
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
  },
});

// The conversation's vocabulary of touch. Kokoro "speaks" in ticks as its words
// appear, detents click under the finger, and arrivals land with a soft weight.
// Every call is optional: silent on web, when haptics are off, or in background.
let enabled = true;
export const setHapticsEnabled = (value: boolean) => { enabled = value; };
const ready = () => enabled && Platform.OS !== 'web' && AppState.currentState === 'active';
const impact = (style: Haptics.ImpactFeedbackStyle) => { if (ready()) Haptics.impactAsync(style).catch(() => {}); };

let lastTick = 0;
export const touch = {
  // The lightest crisp click: a word appearing, a detent passing under the finger.
  tick() {
    if (!ready()) return;
    const now = Date.now();
    if (now - lastTick < 42) return;
    lastTick = now;
    (Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick)
      : Haptics.selectionAsync()).catch(() => {});
  },
  soft: () => impact(Haptics.ImpactFeedbackStyle.Soft),
  light: () => impact(Haptics.ImpactFeedbackStyle.Light),
  rigid: () => impact(Haptics.ImpactFeedbackStyle.Rigid),
  medium: () => impact(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => impact(Haptics.ImpactFeedbackStyle.Heavy),
  success() { if (ready()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  // A crisp, rigid tap for each word Kokoro types. Throttled like tick.
  word() {
    if (!ready()) return;
    const now = Date.now();
    if (now - lastTick < 42) return;
    lastTick = now;
    (Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)).catch(() => {});
  },
  // Two beats, like something arriving: soft, then a little firmer.
  heartbeat() {
    touch.soft();
    setTimeout(() => touch.light(), 140);
  },
  // The welcome's lift is scored like an engine revving (Dan, 26 September: "bam bam
  // bam, faster and faster"). GlassIntro sets the pace from how high the glass has
  // risen; each beat hits harder as it climbs.
  rev(height: number) {
    impact(height < 0.15 ? Haptics.ImpactFeedbackStyle.Light : height < 0.4 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy);
  },
  // The landing: a burst of hard hits, then a rumble that dies away, as if the glass
  // had burst into the orb ("some blow-up kind of vibration").
  blast() {
    const H = Haptics.ImpactFeedbackStyle;
    const beats: [number, Haptics.ImpactFeedbackStyle][] = [
      [0, H.Heavy], [26, H.Heavy], [52, H.Heavy], [78, H.Heavy], [104, H.Heavy], [130, H.Rigid],
      [175, H.Heavy], [225, H.Medium], [285, H.Medium], [355, H.Light], [435, H.Light], [525, H.Soft],
    ];
    for (const [at, style] of beats) setTimeout(() => impact(style), at);
  },
  // Ticks that gather speed and land on one firm beat. Returns a cancel.
  crescendo(duration = 1100, onLand?: () => void) {
    let cancelled = false, at = 0, gap = 150;
    const timers: ReturnType<typeof setTimeout>[] = [];
    while (at < duration) {
      const t = at, style = t > duration * 0.66 ? Haptics.ImpactFeedbackStyle.Rigid : t > duration * 0.33 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Soft;
      timers.push(setTimeout(() => { if (!cancelled) impact(style); }, t));
      at += gap;
      gap = Math.max(34, gap * 0.8);
    }
    timers.push(setTimeout(() => { if (cancelled) return; touch.heavy(); setTimeout(() => !cancelled && touch.soft(), 120); onLand?.(); }, duration + 40));
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  },
};
