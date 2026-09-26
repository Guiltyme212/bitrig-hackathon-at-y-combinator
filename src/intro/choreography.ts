// Platform-independent choreography for the welcome glass. `progress` runs
// 0 → 1 as the glass lifts from below the fold and contracts into Kokoro's
// sphere's exact resting frame. Everything is a worklet so the UI thread can
// derive shader uniforms and overlay styles without touching React.
export type Placement = { x: number; y: number; r: number };

export function clamp(v: number, min = 0, max = 1) {
  'worklet';
  return Math.min(max, Math.max(min, v));
}
export function mix(a: number, b: number, t: number) {
  'worklet';
  return a + (b - a) * t;
}
export function smooth(a: number, b: number, v: number) {
  'worklet';
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// The approved v3 welcome: a 435/393-wide surface whose crown sits at 71% of the screen.
// On the iPhone Duo the resting dome is placed per pose (`rest`, see duoWelcome); on a
// phone it is always this.
export function restingGlass(width: number, height: number, rest?: Placement | null): Placement {
  'worklet';
  if (rest) return rest;
  const r = width * 1.107;
  return { x: width / 2, y: height * 0.7125 + r, r };
}

// Distance a finger travels for the full lift: the crown (the glass's top edge)
// rises about 1.15× as fast as the finger, so the glass stays under it.
export function dragDistance(width: number, height: number, target: Placement, rest?: Placement | null) {
  'worklet';
  const start = restingGlass(width, height, rest);
  return Math.max(height * 0.3, (start.y - start.r - (target.y - target.r)) / 1.15);
}

// One move, no stops: the glass rises and contracts straight into Kokoro's orb's
// place above the conversation, easing in as it lands. (It used to land on a larger
// orb mid-screen, hold, then rise and shrink again; Dan felt that as a stall.)
// A spring's small overshoot past 1 carries it a touch further, then it settles.
export function glassAt(progress: number, width: number, height: number, target: Placement, rest?: Placement | null): Placement {
  'worklet';
  const start = restingGlass(width, height, rest);
  const p = clamp(progress, -0.12, 1.06);
  const u = p > 1 ? 1 + (p - 1) * 0.6 : p;
  return { x: mix(start.x, target.x, u), y: mix(start.y, target.y, u), r: Math.max(8, mix(start.r, target.r, u)) };
}

// Scene layers keyed to progress: stars sink and fade as we rise, colour blooms late.
export function atmosphere(progress: number) {
  'worklet';
  const p = clamp(progress, 0, 1.06);
  return {
    sky: 1 - smooth(0.2, 0.92, p),
    drift: p * 70,
    // The glass stays clear all the way up (Dan: the rise is the beautiful part).
    // Thin-film colour on a big sphere read as a muddy smear, so only a hint of it
    // arrives at the rim as the glass nears the orb's size, while Ember's first
    // frame lights up inside it, so the landing is one crisp image.
    prism: smooth(0.86, 0.98, p) * 0.4,
    wobble: smooth(0.8, 0.98, p),
    calm: 1 - smooth(0, 0.25, p),
    settle: smooth(0.88, 0.985, p),
  };
}

// The glass follows the finger until it lets go (taking over mid-pull felt forced).
// On release: enter past a quarter of the lift, or on a small upward flick.
export function shouldEnter(progress: number, velocity: number) {
  'worklet';
  if (progress > 0.04 && velocity > 1.2) return true;
  return progress > 0.25 || (progress > 0.1 && progress + velocity * 0.18 > 0.3);
}

export function rubberBand(raw: number) {
  'worklet';
  if (raw < 0) return raw * 0.3;
  if (raw > 1) return 1 + (raw - 1) * 0.3;
  return raw;
}
