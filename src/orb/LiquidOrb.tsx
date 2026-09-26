import { memo, useEffect } from 'react';
import { View } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, type DerivedValue, type SharedValue } from 'react-native-reanimated';
import { advanceHand, advanceMotion, FIRST_FLOW, FIRST_TIME, liquidSkia, lookUniforms, lookValues, noFinger, noRipple, openHand, type Finger, type Hand, type LookId, type LookValues, type Motion, type Ripple } from './liquid';

const effect = Skia.RuntimeEffect.Make(liquidSkia)!;

type Props = {
  size: number;                              // square canvas side
  radius?: number;                           // the sphere's radius in points
  look: DerivedValue<LookValues> | LookId;   // a look, or one that morphs (the voice dial)
  level?: SharedValue<number>;               // 0..1, the voice's energy
  touch?: SharedValue<number[]>;             // the last tap: x, y (orb units) and a tap count
  paused?: boolean;                          // hold the first frame (behind the welcome glass)
  finger?: SharedValue<Finger>;              // a finger on the glass (useOrbTouch): hold, drag
};

// The live orb: its light drifts slowly, the voice brightens it, swells the ribbons
// and rings the glass. A touch sends glassy waves out from that one spot; holding
// breathes in; a drag moves the ball a little and the light inside lags behind.
function LiquidOrb({ size, radius = size * 0.29, look, level, touch, paused = false, finger }: Props) {
  const reduced = useReducedMotion();
  const still = useSharedValue(typeof look === 'string' ? lookValues(look) : [0]);
  const quiet = useSharedValue(0);
  const untouched = useSharedValue([0, 0, 0]);
  const away = useSharedValue<Finger>(noFinger);
  useEffect(() => { if (typeof look === 'string') still.set(lookValues(look)); }, [look, still]);
  const values = typeof look === 'string' ? still : look;
  const voice = level ?? quiet;
  const taps = touch ?? untouched;
  const hand = finger ?? away;

  // Time, the voice's smoothed energy, the ribbons' accumulated phase and the last
  // tap's ripple, advanced together once a frame on the UI thread.
  const time = useSharedValue(FIRST_TIME);
  const motion = useSharedValue<Motion>({ energy: 0, flow: FIRST_FLOW });
  const frozen = useSharedValue(paused);
  useEffect(() => { frozen.set(paused); }, [paused, frozen]);
  const ripple = useSharedValue<Ripple>(noRipple);
  const seen = useSharedValue(0);
  const held = useSharedValue<Hand>(openHand);
  useFrameCallback(frame => {
    if (frozen.get()) return;
    const real = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const dt = real * (reduced ? 0.3 : 1);
    time.set(time.get() + dt);
    held.set(advanceHand(held.get(), hand.get(), Date.now(), real));
    // A voice's envelope runs hotter than the lab's analyser; scaled so the glass stays
    // mostly dark and the light inside brightens rather than fills it.
    motion.set(advanceMotion(motion.get(), Math.min(1, voice.get()) * 0.6, dt, held.get().press));
    const [x, y, count] = taps.get();
    const r = ripple.get();
    if (count !== seen.get()) { seen.set(count); ripple.set([x, y, 0, reduced ? 0.5 : 1]); }
    else if (r[3] > 0) ripple.set([r[0], r[1], r[2] + dt, r[2] > 4 ? 0 : r[3]]);
  });
  const uniforms = useDerivedValue(() => {
    const m = motion.get(), h = held.get();
    return lookUniforms(values.get(), size, radius, time.get(), m.energy, h.press, m.flow, ripple.get(), [h.sx, h.sy]);
  });
  return <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Canvas style={{ width: size, height: size }}>
      <Fill><Shader source={effect} uniforms={uniforms} /></Fill>
    </Canvas>
  </View>;
}

// A still of a look, for rows, cards and the seats on the dial: drawn once, no clock.
export const LiquidStill = memo(function LiquidStill({ size, radius = size * 0.42, look }: { size: number; radius?: number; look: LookId }) {
  const uniforms = lookUniforms(lookValues(look), size, radius, FIRST_TIME, 0);
  return <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Canvas style={{ width: size, height: size }}>
      <Fill><Shader source={effect} uniforms={uniforms} /></Fill>
    </Canvas>
  </View>;
});

export default memo(LiquidOrb);
