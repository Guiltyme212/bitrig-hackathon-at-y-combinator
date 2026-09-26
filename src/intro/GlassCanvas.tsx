import { Canvas, Fill, ImageShader, Shader, Skia, useClock, useImage } from '@shopify/react-native-skia';
import { Image, StyleSheet, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';
import { atmosphere, glassAt } from './choreography';
import { ORB_IN_POSTER, PRISM_POSTER_SIZE, skiaGlass } from './glassMaterial';
import type { GlassCanvasProps } from './types';

const effect = Skia.RuntimeEffect.Make(skiaGlass);

export default function GlassCanvas({ width, height, target, rest, reduced, progress, contactX, contactY, contactForce, stretch, appear }: GlassCanvasProps) {
  const clock = useClock();
  // Ember's first frame (rendered from the orb's own shader), so the glass settles
  // into exactly the image the live orb starts on. It rides inside the glass, sized
  // to it, so it lines up at every moment of the landing, not only at the end.
  const poster = useImage(require('../../assets/orb/ember-poster.png'));
  const uniforms = useDerivedValue(() => {
    const p = progress.get();
    const glass = glassAt(p, width, height, target, rest);
    const scene = atmosphere(p);
    const time = reduced ? 3 : clock.get() / 1000;
    return {
      resolution: [width, height],
      time,
      reduced: reduced ? 1 : 0,
      sphere: [glass.x, glass.y, glass.r],
      contact: [contactX.get(), contactY.get(), reduced ? 0 : contactForce.get()],
      prism: scene.prism,
      sky: scene.sky,
      drift: scene.drift,
      wobble: scene.wobble,
      stretch: reduced ? 0 : stretch.get(),
      breath: reduced ? 0.5 : scene.calm * (0.5 + 0.5 * Math.sin(time * 0.9)),
      appear: appear.get(),
      settle: scene.settle,
      frame: [glass.x, glass.y, glass.r / ORB_IN_POSTER],
    };
  }, [width, height, target.x, target.y, target.r, rest?.x, rest?.y, rest?.r, reduced]);

  // A shader that fails to compile falls back to the approved still of the welcome.
  if (!effect) return <Image source={require('../../assets/glass-plate.jpg')} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="cover" />;
  // The local poster decodes in a frame or two; the welcome fades up from black anyway.
  if (!poster) return null;
  return <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
    <Canvas style={{ width, height }}>
      <Fill>
        <Shader source={effect} uniforms={uniforms}>
          <ImageShader image={poster} fit="fill" rect={{ x: 0, y: 0, width: PRISM_POSTER_SIZE, height: PRISM_POSTER_SIZE }} />
        </Shader>
      </Fill>
    </Canvas>
  </View>;
}
