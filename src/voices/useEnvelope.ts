import { useMemo } from 'react';
import { useFrameCallback, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';

// Drives the orb from a precomputed loudness envelope, on the UI thread, anchored
// to the moment playback started. Cheaper and steadier than streaming PCM across
// the bridge, and it works the same in Expo Go and in a build.
export function useEnvelope(envelopes: number[][], rate: number, target?: { level: SharedValue<number>; progress: SharedValue<number> }) {
  const data = useSharedValue(envelopes);
  const ownLevel = useSharedValue(0), ownProgress = useSharedValue(0);
  const level = target?.level ?? ownLevel, progress = target?.progress ?? ownProgress;
  const anchor = useSharedValue(-1);
  const startAt = useSharedValue(0);
  const pending = useSharedValue(false);
  const which = useSharedValue(0);

  useFrameCallback(frame => {
    if (pending.get()) { anchor.set(frame.timestamp - startAt.get() * 1000); pending.set(false); }
    const a = anchor.get(), l = level.get();
    if (a < 0) return;
    const env = data.get()[which.get()];
    const t = (frame.timestamp - a) / 1000;
    const i = Math.floor(t * rate);
    const target = i >= 0 && i < env.length ? env[i] / 99 : 0;
    // A quick attack and a slower release, like a meter with some weight to it.
    level.set(l + (target - l) * (target > l ? 0.42 : 0.16));
    progress.set(Math.min(1, t / (env.length / rate)));
  });

  return useMemo(() => ({
    level,
    progress,
    // Start (or re-anchor) the clock for envelope `index` at `seconds` into it.
    start(index: number, seconds = 0) { which.set(index); startAt.set(seconds); pending.set(true); },
    stop(immediate = true) {
      anchor.set(-1);
      level.set(withTiming(0, { duration: 500 }));
      progress.set(immediate ? 0 : withDelay(450, withTiming(0, { duration: 700 })));
    },
  }), [level, progress, which, startAt, pending, anchor]);
}
