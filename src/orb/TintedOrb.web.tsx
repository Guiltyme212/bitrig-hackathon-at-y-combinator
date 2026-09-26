import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { prismPalette, type Palette } from './palette';

export { colorPalette, hexPalette, prismPalette, pulse, useOrbControls } from './palette';
export type { OrbControls, Palette } from './palette';

const loop = require('../../assets/video/prism-loop.mp4');
const poster = require('../../assets/video/prism-poster.jpg');

// The browser has no Skia here, so the orb is the Prism loop composited with
// `screen` (its black matte disappears) and recoloured with a CSS filter that
// approximates the native luminance ramp. Close enough for a preview in a tab.
function hue([r, g, b]: number[]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const filterFor = (p: Palette, amount: number) => amount < 0.35 ? 'none' : `grayscale(1) sepia(1) saturate(3.2) hue-rotate(${Math.round(hue([p[3], p[4], p[5]]) - 38)}deg) brightness(1.08)`;

type Props = { size: number; frame?: number; palette?: SharedValue<Palette>; amount?: SharedValue<number>; level?: SharedValue<number>; progress?: SharedValue<number>; time?: SharedValue<number>; startAt?: number; paused?: boolean; waves?: boolean; aura?: boolean };

export default function TintedOrb({ size, frame = size * 0.78, palette, amount, level, paused = false }: Props) {
  const player = useVideoPlayer(loop, video => { video.loop = true; video.muted = true; });
  useEffect(() => { if (paused) player.pause(); else player.play(); }, [paused, player]);
  const fallbackPalette = useSharedValue<Palette>(prismPalette), fallbackAmount = useSharedValue(0), fallbackLevel = useSharedValue(0);
  const pal = palette ?? fallbackPalette, amt = amount ?? fallbackAmount, lvl = level ?? fallbackLevel;
  const [filter, setFilter] = useState('none');
  useAnimatedReaction(() => filterFor(pal.get(), amt.get()), (next, before) => { if (next !== before) scheduleOnRN(setFilter, next); });
  const swell = useAnimatedStyle(() => ({ transform: [{ scale: 1 + lvl.get() * 0.045 }] }));
  const media = { width: frame, height: frame, mixBlendMode: 'screen', filter } as object;
  return <View pointerEvents="none" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={[{ width: frame, height: frame }, swell]}>
      <Image source={poster} style={[{ position: 'absolute' }, media]} contentFit="contain" />
      <VideoView player={player} nativeControls={false} contentFit="contain" style={media} />
    </Animated.View>
  </View>;
}

export function OrbStill({ size, palette, amount = 0.92 }: { size: number; palette: Palette; amount?: number }) {
  return <Image source={poster} style={{ width: size, height: size, borderRadius: size / 2, filter: filterFor(palette, amount), transform: [{ scale: 1.18 }] } as object} contentFit="cover" />;
}
