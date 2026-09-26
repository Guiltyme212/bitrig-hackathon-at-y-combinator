import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import { useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { lookValues, type LookId, type LookValues } from './liquid';

// A palette is nine numbers: deep, mid and glow as linear 0..1 RGB.
export type Palette = readonly number[];
export const prismPalette: Palette = [0, 0, 0, 0.5, 0.5, 0.5, 1, 1, 1];

export const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
export function hexPalette(deep: string, mid: string, glow: string): Palette {
  return [...rgb(deep), ...rgb(mid), ...rgb(glow)];
}
// A palette grown from one colour: a deep shade, the colour, and a pale glow.
export function colorPalette(hex: string): Palette {
  const c = rgb(hex);
  return [...c.map(v => v * 0.14), ...c, ...c.map(v => v + (1 - v) * 0.78)];
}

// The orb's live inputs, owned by whichever screen is conducting it. `look` is the
// liquid orb's (a voice's orb, morphing on the dial); palette and amount tint the Prism.
// `touch` is the last tap on the liquid orb: x, y in orb units (y up) and a count that
// goes up with every tap, so the orb knows to start a new ripple.
export type OrbControls = { palette: SharedValue<Palette>; amount: SharedValue<number>; level: SharedValue<number>; progress: SharedValue<number>; look: SharedValue<LookValues>; touch: SharedValue<number[]> };
export function useOrbControls(initial: Palette = prismPalette, initialAmount = 0, initialLook: LookId = 'night'): OrbControls {
  return { palette: useSharedValue(initial), amount: useSharedValue(initialAmount), level: useSharedValue(0), progress: useSharedValue(0), look: useSharedValue(lookValues(initialLook)), touch: useSharedValue([0, 0, 0]) };
}
// Record a tap on the liquid orb, from a point measured in the sphere's own box.
export function tapOrb(touch: SharedValue<number[]>, x: number, y: number, radius: number) {
  'worklet';
  const [, , count] = touch.get();
  const u = (x - radius) / radius, v = (radius - y) / radius;
  touch.set([Number.isFinite(u) ? u : 0, Number.isFinite(v) ? v : 0, count + 1]);
}
// One soft pulse, as if the orb breathed out a word.
export function pulse(level: SharedValue<number>, strength = 0.32) {
  level.set(withSequence(withTiming(Math.max(level.get(), strength), { duration: 70 }), withTiming(0, { duration: 420 })));
}


// A bundled asset's local URI, once it has been copied out of the bundle.
export function useAssetUri(module: number) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const asset = Asset.fromModule(module);
    asset.downloadAsync().then(() => { if (alive) setUri(asset.localUri ?? asset.uri); }).catch(() => {});
    return () => { alive = false; };
  }, [module]);
  return uri;
}
