import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { Icon } from '../ui/Icon';

// While Kokoro listens, a microphone settles into the middle of the orb and breathes
// with the person's voice (the orb's light swells with it too), so it's plain that
// the orb is listening and that it hears them. Drawn inside the orb's own frame.
export function ListeningMark({ listening, level, center, radius }: { listening: boolean; level: SharedValue<number>; center: number; radius: number }) {
  const shown = useSharedValue(0);
  useEffect(() => { shown.set(withSpring(listening ? 1 : 0, { duration: 520, dampingRatio: 0.9 })); }, [listening, shown]);
  const size = Math.round(radius * 0.4);
  const style = useAnimatedStyle(() => {
    const l = Math.min(1, level.get());
    return { opacity: shown.get() * (0.72 + 0.28 * l), transform: [{ scale: (0.8 + 0.2 * shown.get()) * (1 + 0.14 * l) }] };
  });
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[{ position: 'absolute', left: center - size / 2, top: center - size / 2, width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
    <Icon name="mic.fill" size={size} color="#FFF4EA" />
  </Animated.View>;
}
