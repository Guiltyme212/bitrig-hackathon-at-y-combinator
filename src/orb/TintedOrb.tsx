import { memo, useEffect } from 'react';
import { View } from 'react-native';
import { BlendMode, Canvas, Circle, createPicture, Group, Image, Paint, PaintStyle, Picture, RadialGradient, RuntimeShader, Skia, TileMode, useImage, useVideo, vec } from '@shopify/react-native-skia';
import { useAnimatedReaction, useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { prismPalette, useAssetUri, type Palette } from './palette';

const loop = require('../../assets/video/prism-loop.mp4');
const poster = require('../../assets/video/prism-poster.jpg');

// Recolours the Prism sphere through a three-stop ramp (deep, mid, glow) and
// turns its black matte transparent, so the orb composites like light over
// whatever sits behind it. `amount` 0 keeps Prism's own colours.
const tint = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform float3 deep;
uniform float3 mid;
uniform float3 glow;
uniform float amount;
uniform float lift;
half4 main(float2 xy) {
  half4 c = image.eval(xy);
  float3 rgb = c.a > 0.0 ? c.rgb / c.a : float3(0.0);
  float l = dot(rgb, float3(0.2126, 0.7152, 0.0722));
  float3 ramp = l < 0.5 ? mix(deep, mid, l * 2.0) : mix(mid, glow, (l - 0.5) * 2.0);
  float3 col = mix(rgb, ramp * smoothstep(0.015, 0.1, l), amount) * (1.0 + lift);
  col = clamp(col, 0.0, 1.0);
  float a = max(max(col.r, col.g), col.b);
  return half4(col, a);
}`)!;

export { colorPalette, hexPalette, prismPalette, pulse, useOrbControls } from './palette';
export type { OrbControls, Palette } from './palette';

// Anima's silk: a ribbon of hairline strands that threads through the orb. Each
// strand rides the same slow wave a little out of phase, and the ribbon twists
// as it travels, so the strands gather and part like light on a scarf. At rest
// it's a faint line through the orb's equator; the voice lifts and quickens it.
const STRANDS = 32, STEPS = 64;
function Silk({ size, sphere, level, palette, amount }: { size: number; sphere: number; level: SharedValue<number>; palette: SharedValue<Palette>; amount: SharedValue<number> }) {
  // Time runs faster while the voice speaks, without a jump when it starts. The
  // silk hears the voice through a slow release, so it flows between words
  // instead of snapping flat at every gap.
  const phase = useSharedValue(0), energy = useSharedValue(0);
  useFrameCallback(frame => {
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const target = Math.min(1, level.get()), e = energy.get();
    energy.set(e + (target - e) * (target > e ? 0.16 : 0.03));
    phase.set(phase.get() + dt * (0.3 + energy.get() * 1.3));
  });
  const picture = useDerivedValue(() => {
    const t = phase.get(), lv = energy.get();
    const p = palette.get(), a = amount.get();
    const r = p[6] * a + 0.94 * (1 - a), g = p[7] * a + 0.94 * (1 - a), b = p[8] * a + 0.96 * (1 - a);
    const c = size / 2, reach = size / 2;
    // The ribbon fades out toward both ends instead of stopping at the canvas edge.
    const shader = Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: size, y: 0 },
      [Float32Array.of(r, g, b, 0), Float32Array.of(r, g, b, 1), Float32Array.of(r, g, b, 1), Float32Array.of(r, g, b, 0)], [0.02, 0.22, 0.78, 0.98], TileMode.Clamp);
    const lift = sphere * (0.05 + lv * 0.55);     // how far the ribbon's spine swings
    const width = sphere * (0.16 + lv * 0.34);    // how wide it opens when it faces you
    const glow = 0.3 + lv * 0.95;
    return createPicture(canvas => {
      const paint = Skia.Paint();
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(0.8);
      paint.setAntiAlias(true);
      paint.setBlendMode(BlendMode.Plus);
      paint.setShader(shader);
      for (let i = 0; i < STRANDS; i++) {
        const s = i / (STRANDS - 1), off = s - 0.5;
        const path = Skia.PathBuilder.Make();
        for (let j = 0; j <= STEPS; j++) {
          const u = (j / STEPS) * 2 - 1;
          // Wide enough that the ribbon's waves are seen beside the orb, not only across it.
          const env = Math.exp(-u * u * 1.5);
          // The spine: two slow waves, each strand a breath out of phase.
          const spine = Math.sin(u * 5.2 + t * 1.6 + off * 0.7) * 0.8 + Math.sin(u * 8.7 - t * 2.1 + off * 0.4) * 0.28;
          // The twist: where the ribbon turns edge-on the strands gather into a thread.
          const face = Math.cos(u * 3.4 - t * 0.85);
          const y = c + env * (lift * spine + width * off * 2 * face);
          if (j === 0) path.moveTo(c + u * reach, y); else path.lineTo(c + u * reach, y);
        }
        paint.setAlphaf(Math.min(1, (0.06 + Math.sin(Math.PI * s) * 0.24) * glow));
        canvas.drawPath(path.detach(), paint);
      }
    }, Skia.XYWHRect(0, 0, size, size));
  });
  return <Picture picture={picture} />;
}

type Props = {
  size: number;                    // square canvas side
  frame?: number;                  // side of the video frame drawn in it (sphere radius = 41.8%)
  palette?: SharedValue<Palette>;
  amount?: SharedValue<number>;    // 0 = Prism's colours, 1 = the palette
  level?: SharedValue<number>;     // 0..1, voice energy: brightens, swells, lifts the silk
  progress?: SharedValue<number>;  // accepted with the controls; the silk shows the voice now
  time?: SharedValue<number>;      // receives the loop's playhead, for a seamless hand-over
  startAt?: number;                // start the loop here (seconds), to continue another orb
  paused?: boolean;
  waves?: boolean;                 // the silk ribbon through the orb
  aura?: boolean;
};

// The Prism loop drawn in Skia so it can take on a voice's colour and breathe with it.
function TintedOrb({ size, frame = size * 0.78, palette, amount, level, time, startAt, paused = false, waves = false, aura = true }: Props) {
  const uri = useAssetUri(loop);
  const still = useImage(poster);
  const isPaused = useSharedValue(paused);
  useEffect(() => { isPaused.set(paused); }, [paused, isPaused]);
  const seek = useSharedValue<number | null>(startAt ?? null);
  const { currentFrame, currentTime } = useVideo(uri, { looping: true, paused: isPaused, volume: 0, seek });
  useAnimatedReaction(() => currentTime.get(), t => { if (time) time.set(t); });
  const fallbackPalette = useSharedValue<Palette>(prismPalette), fallbackAmount = useSharedValue(0), fallbackLevel = useSharedValue(0);
  const pal = palette ?? fallbackPalette, amt = amount ?? fallbackAmount, lvl = level ?? fallbackLevel;

  const c = size / 2;
  const sphere = frame * 0.418;
  const image = useDerivedValue(() => currentFrame.get() ?? still);
  const uniforms = useDerivedValue(() => {
    const p = pal.get();
    return { deep: [p[0], p[1], p[2]], mid: [p[3], p[4], p[5]], glow: [p[6], p[7], p[8]], amount: amt.get(), lift: lvl.get() * 0.35 };
  });
  // The sphere swells a little with the voice, around its own centre.
  const swell = useDerivedValue(() => [{ translateX: c }, { translateY: c }, { scale: 1 + lvl.get() * 0.045 }, { translateX: -c }, { translateY: -c }]);
  const auraColor = useDerivedValue(() => {
    const p = pal.get(), a = amt.get();
    const mix = (i: number) => Math.round(255 * (p[3 + i] * a + 0.55 * (1 - a)));
    return [`rgba(${mix(0)},${mix(1)},${mix(2)},${0.09 + a * 0.13 + lvl.get() * 0.22})`, 'rgba(0,0,0,0)'];
  });
  const auraRadius = useDerivedValue(() => sphere * (1.9 + lvl.get() * 0.35));

  return <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Canvas style={{ width: size, height: size }}>
      {aura && <Circle cx={c} cy={c} r={auraRadius}>
        <RadialGradient c={vec(c, c)} r={auraRadius} colors={auraColor} />
      </Circle>}
      <Group transform={swell} layer={<Paint><RuntimeShader source={tint} uniforms={uniforms} /></Paint>}>
        <Image image={image} x={c - frame / 2} y={c - frame / 2} width={frame} height={frame} fit="contain" />
      </Group>
      {waves && <Silk size={size} sphere={sphere} level={lvl} palette={pal} amount={amt} />}
    </Canvas>
  </View>;
}

// A still of the orb in a voice's colour, for rows and cards where a moving
// video would be too much.
export const OrbStill = memo(function OrbStill({ size, palette, amount = 0.92 }: { size: number; palette: Palette; amount?: number }) {
  const still = useImage(poster);
  const uniforms = { deep: [palette[0], palette[1], palette[2]], mid: [palette[3], palette[4], palette[5]], glow: [palette[6], palette[7], palette[8]], amount, lift: 0 };
  const frame = size * 1.18;
  return <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Canvas style={{ width: size, height: size }}>
      <Group layer={<Paint><RuntimeShader source={tint} uniforms={uniforms} /></Paint>}>
        {still && <Image image={still} x={(size - frame) / 2} y={(size - frame) / 2} width={frame} height={frame} fit="contain" />}
      </Group>
    </Canvas>
  </View>;
});

// Its inputs are shared values and sizes, so a parent's re-render never needs to redraw it.
export default memo(TintedOrb);
