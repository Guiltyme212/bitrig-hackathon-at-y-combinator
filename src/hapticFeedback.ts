export type HapticMoment = 'select' | 'touch' | 'advance' | 'complete';

type HapticDriver = {
  available: () => boolean;
  play: (moment: HapticMoment) => Promise<void>;
  now?: () => number;
};

// Drop bursts instead of queuing vibration after the interaction has ended.
export function createHapticFeedback({ available, play, now = Date.now }: HapticDriver) {
  let last: number | undefined;
  return async (moment: HapticMoment, enabled = true): Promise<void> => {
    if (!enabled || !available()) return;
    const time = now();
    if (last !== undefined && time - last < 120) return;
    last = time;
    try {
      await play(moment);
    } catch {
      // Feedback is optional; unavailable hardware never interrupts navigation.
    }
  };
}
