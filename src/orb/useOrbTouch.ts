import { useEffect, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { touch as haptic } from '../haptics';
import type { Finger } from './liquid';
import { tapOrb } from './palette';

// Touching Kokoro's orb exactly as the Orb Lab handles the mouse (Dan, 26 September:
// the lab felt right, the phone sent waves all over after the finger). A touch sends
// one glassy ripple out from the spot it landed on, and only that spot; holding
// breathes in; a drag moves the ball a little after the finger while the light inside
// lags behind; letting go lets it drift back. And it's felt (Dan: "I really wanna feel
// good haptics… how the orb is being pulled"): a soft touch as the finger lands, fine
// clicks as the ball is pulled, a firmer one when it can't go further, a slow
// heartbeat while it's held, and a soft touch as it's let go.
// This hook only reports the finger; the orb eases it frame by frame (advanceHand).
// `radius` is the touch circle's radius in its own (unscaled) points.
export function useOrbTouch(touch: SharedValue<number[]>, radius: number) {
  const finger = useSharedValue<Finger>([0, 0, 0, 0]);
  const start = useSharedValue([0, 0]);
  const pulled = useSharedValue([0, 0, 0]);   // last click position (x, y) and whether the ball is at its limit
  // The lab's reach: the orb follows 45% of the finger's travel, up to 0.14 (in the
  // shader's units, where the sphere's radius is 0.58), y up.
  const reach = (0.58 / radius) * 0.45;

  // The heartbeat while held runs on the JS side.
  const beat = useRef<{ wait?: ReturnType<typeof setTimeout>; pulse?: ReturnType<typeof setInterval> }>({});
  const stopHold = () => { clearTimeout(beat.current.wait); clearInterval(beat.current.pulse); beat.current = {}; };
  const startHold = () => {
    stopHold();
    beat.current.wait = setTimeout(() => {
      haptic.soft();
      beat.current.pulse = setInterval(() => haptic.soft(), 850);
    }, 450);
  };
  const letGo = (dragged: boolean) => { stopHold(); if (dragged) haptic.light(); };
  useEffect(() => stopHold, []);

  const gesture = Gesture.Pan()
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onBegin(e => {
      tapOrb(touch, e.x, e.y, radius);
      start.set([e.x, e.y]);
      pulled.set([e.x, e.y, 0]);
      finger.set([1, Date.now(), 0, 0]);
      scheduleOnRN(haptic.soft);
      scheduleOnRN(startHold);
    })
    .onUpdate(e => {
      const [sx, sy] = start.get();
      const cap = (v: number) => Math.max(-0.14, Math.min(0.14, v));
      const tx = (e.x - sx) * reach, ty = (sy - e.y) * reach;
      finger.set([1, finger.get()[1], cap(tx), cap(ty)]);
      // A fine click for every stretch of pull; a firmer one at the limit.
      const [px, py, atLimit] = pulled.get();
      const limit = Math.abs(tx) >= 0.14 || Math.abs(ty) >= 0.14 ? 1 : 0;
      if (limit && !atLimit) { pulled.set([e.x, e.y, 1]); scheduleOnRN(haptic.rigid); return; }
      if (Math.hypot(e.x - px, e.y - py) > 18) { pulled.set([e.x, e.y, limit]); if (!limit) scheduleOnRN(haptic.tick); }
      else if (!limit && atLimit) pulled.set([px, py, 0]);
    })
    .onFinalize(() => {
      const [sx, sy] = start.get(), [px, py] = pulled.get();
      finger.set([0, finger.get()[1], 0, 0]);
      scheduleOnRN(letGo, Math.hypot(px - sx, py - sy) > 18);
    });
  return { gesture, finger };
}
