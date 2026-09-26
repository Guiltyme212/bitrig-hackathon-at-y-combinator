import type { SharedValue } from 'react-native-reanimated';
import type { Placement } from './choreography';

export type GlassCanvasProps = {
  width: number;
  height: number;
  target: Placement;
  // iPhone Duo only: where the dome rests (otherwise the phone's resting glass).
  rest?: Placement | null;
  reduced: boolean;
  progress: SharedValue<number>;
  contactX: SharedValue<number>;
  contactY: SharedValue<number>;
  contactForce: SharedValue<number>;
  stretch: SharedValue<number>;
  appear: SharedValue<number>;
};

// iPhone Duo only: where the wordmark and the invitation go (x, width, tops), so the words
// can sit on their own page while the glass runs full-bleed. Absent on a phone.
export type WelcomeWords = { x: number; w: number; top: number; invite: number };
