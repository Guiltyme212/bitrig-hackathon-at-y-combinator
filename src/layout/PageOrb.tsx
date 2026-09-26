import { Pressable, View } from 'react-native';
import LiquidOrb from '../orb/LiquidOrb';
import { tapOrb, type OrbControls } from '../orb/palette';
import { useDuo, useFrameSize } from './Duo';
import { pageOrb } from './geometry';

// iPhone Duo, open: the voice's live orb, centred on the orb page (render it inside a
// <Region> at that page). Touch only ripples the glass: the orb is felt, not a button.
export default function PageOrb({ orb, scale = 1 }: { orb: OrbControls; scale?: number }) {
  const L = useDuo();
  const { width, height } = useFrameSize();
  const home = pageOrb({ w: width, h: height }, L.geometry);
  const r = home.r * scale, size = Math.ceil(r / 0.301);
  return <View pointerEvents="box-none" style={{ position: 'absolute', left: home.cx - size / 2, top: home.cy - size / 2, width: size, height: size }}>
    <LiquidOrb size={size} radius={r} look={orb.look} level={orb.level} touch={orb.touch} />
    <Pressable accessible={false} onPressIn={e => tapOrb(orb.touch, e.nativeEvent.locationX, e.nativeEvent.locationY, r)}
      style={{ position: 'absolute', left: size / 2 - r, top: size / 2 - r, width: r * 2, height: r * 2, borderRadius: r }} />
  </View>;
}
