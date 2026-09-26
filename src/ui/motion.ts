import { Easing, withDelay, withTiming } from 'react-native-reanimated';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

// An entrance that only moves. Anything holding Liquid Glass must never fade its
// own opacity (UIKit drops the material), so containers rise and the glass
// inside materialises by itself (`appear` on the Glass components).
export const rise = (delay = 0, distance = 16, duration = 620) => () => {
  'worklet';
  return {
    initialValues: { transform: [{ translateY: distance }] },
    animations: { transform: [{ translateY: withDelay(delay, withTiming(0, { duration, easing: EASE })) }] },
  };
};
