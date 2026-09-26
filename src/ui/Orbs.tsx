import { useEffect } from 'react';
import { Easing, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import LiquidOrb, { LiquidStill } from '../orb/LiquidOrb';
import { voiceById } from '../voices/voices';
import { useKokoro } from '../store';

// The orb of a voice (theirs, unless a session says otherwise), as a still.
export function MiniOrb({ size, voiceId }: { size: number; voiceId?: string }) {
  const chosen = useKokoro(s => s.voiceId);
  return <LiquidStill size={size} radius={size * 0.46} look={voiceById(voiceId ?? chosen).look} />;
}

// The live orb of their voice. `breathing` swells its light gently, 4 in and 6 out.
export function LiveOrb({ size, breathing = false, voiceId }: { size: number; breathing?: boolean; voiceId?: string }) {
  const reduced = useReducedMotion();
  const chosen = useKokoro(s => s.voiceId);
  const voice = voiceById(voiceId ?? chosen);
  const level = useSharedValue(0);
  useEffect(() => {
    if (!breathing || reduced) { level.set(withTiming(0.05)); return; }
    level.set(withRepeat(withSequence(withTiming(0.28, { duration: 4000, easing: Easing.inOut(Easing.sin) }), withTiming(0.04, { duration: 6000, easing: Easing.inOut(Easing.sin) })), -1));
  }, [breathing, reduced, level]);
  return <LiquidOrb size={size} radius={size * 0.36} look={voice.look} level={level} />;
}

// Kokoro's own orb, Ember, as it is at the end of the welcome and in every
// conversation. `breathing` swells its light gently, 4 in and 6 out.
export function KokoroOrb({ size, breathing = false }: { size: number; breathing?: boolean }) {
  const reduced = useReducedMotion();
  const level = useSharedValue(0);
  useEffect(() => {
    if (!breathing || reduced) { level.set(withTiming(0.05)); return; }
    level.set(withRepeat(withSequence(withTiming(0.28, { duration: 4000, easing: Easing.inOut(Easing.sin) }), withTiming(0.04, { duration: 6000, easing: Easing.inOut(Easing.sin) })), -1));
  }, [breathing, reduced, level]);
  return <LiquidOrb size={size} radius={size * 0.276} look="ember" level={level} />;
}
