// The new orb, from the orb palette : liquid
// glass drawn in code, in seven layers — shape, depth, light inside, glass tint,
// lens, highlights, motion. Nearly clear in the middle, the rim bends the light
// like a lens, and nothing is drawn outside the glass: no glow, no outline.
// Written once in the GLSL subset that both WebGL and Skia's SkSL accept.

export type LookId = 'ember' | 'amber' | 'sunset' | 'candle' | 'night';
type V3 = [number, number, number];
type Look = {
  name: string;
  ribA: V3; ribB: V3; ribC: V3; heart: V3; absorb: V3; body: V3; caustic: V3; rimTint: V3;
  horiz: number; ribW: number; heartSize: number; flame: number; flicker: number; lens: number; bevel: number; aberr: number; wobble: number;
};

// ribA/B/C: three soft ribbons of light (upright, or lying like a horizon when horiz = 1).
// heart: the warm glow low in the glass (flame = 1 stands it up like a candle flame).
// absorb: how the glass tints the light with thickness · lens/bevel/aberr: bending at the rim.
export const looks: Record<LookId, Look> = {
  ember: {
    name: 'Ember', ribA: [1, 0.12, 0.03], ribB: [1.6, 0.55, 0.1], ribC: [1.1, 0.22, 0.05], heart: [1.2, 0.4, 0.06], absorb: [0.05, 0.35, 0.9],
    body: [0.012, 0.003, 0.002], caustic: [1.2, 0.45, 0.1], rimTint: [1.15, 0.85, 0.62],
    horiz: 0, ribW: 1, heartSize: 0.08, flame: 0, flicker: 0.6, lens: 0.4, bevel: 4, aberr: 0.12, wobble: 0.012,
  },
  amber: {
    name: 'Amber', ribA: [0.9, 0.45, 0.08], ribB: [1.5, 0.95, 0.35], ribC: [1, 0.55, 0.12], heart: [1.3, 0.75, 0.25], absorb: [0.06, 0.4, 1.4],
    body: [0.03, 0.012, 0.003], caustic: [1.3, 0.85, 0.35], rimTint: [1.15, 0.92, 0.66],
    horiz: 0, ribW: 1.3, heartSize: 0.12, flame: 0, flicker: 0.2, lens: 0.36, bevel: 4, aberr: 0.1, wobble: 0.01,
  },
  sunset: {
    name: 'Sunset', ribA: [1, 0.1, 0.06], ribB: [1.6, 0.5, 0.1], ribC: [1.6, 0.85, 0.22], heart: [0.6, 0.2, 0.04], absorb: [0.03, 0.12, 0.35],
    body: [0.01, 0.004, 0.004], caustic: [1.2, 0.5, 0.2], rimTint: [1.15, 0.85, 0.66],
    horiz: 1, ribW: 1.4, heartSize: 0.06, flame: 0, flicker: 0, lens: 0.42, bevel: 3.5, aberr: 0.06, wobble: 0.01,
  },
  candle: {
    name: 'Candle', ribA: [0.25, 0.05, 0.01], ribB: [0.35, 0.12, 0.02], ribC: [0.25, 0.06, 0.01], heart: [2, 1.1, 0.35], absorb: [0.04, 0.2, 0.5],
    body: [0.008, 0.004, 0.002], caustic: [1.4, 0.8, 0.3], rimTint: [1.15, 0.95, 0.72],
    horiz: 0, ribW: 0.8, heartSize: 0.05, flame: 1, flicker: 1, lens: 0.38, bevel: 4, aberr: 0.1, wobble: 0.01,
  },
  night: {
    name: 'Night', ribA: [0.15, 0.3, 0.9], ribB: [0.8, 0.9, 1.1], ribC: [0.25, 0.4, 1], heart: [0.3, 0.45, 0.9], absorb: [0.4, 0.15, 0.04],
    body: [0.003, 0.005, 0.012], caustic: [0.5, 0.7, 1.2], rimTint: [1, 1.1, 1.3],
    horiz: 0, ribW: 1.1, heartSize: 0.1, flame: 0, flicker: 0, lens: 0.4, bevel: 4, aberr: 0.12, wobble: 0.012,
  },
};

// A look as 33 numbers, so it can live in a shared value and morph on the UI thread.
export type LookValues = number[];
const vectors = ['ribA', 'ribB', 'ribC', 'heart', 'absorb', 'body', 'caustic', 'rimTint'] as const;
const scalars = ['horiz', 'ribW', 'heartSize', 'flame', 'flicker', 'lens', 'bevel', 'aberr', 'wobble'] as const;
export function lookValues(id: LookId): LookValues {
  const look = looks[id];
  return [...vectors.flatMap(k => look[k]), ...scalars.map(k => look[k])];
}
export function mixLooks(a: LookValues, b: LookValues, f: number): LookValues {
  'worklet';
  return a.map((v, i) => v + (b[i] - v) * f);
}

// One orb becoming another. Halfway, two lights of different colours mixed read as
// mud (orange and blue make purple), so the light dips as it changes: one colour
// cools away and the next rises. `dip` is how low it goes at the midpoint.
export function morphLooks(a: LookValues, b: LookValues, f: number, dip = 0.5): LookValues {
  'worklet';
  const out = mixLooks(a, b, f);
  const k = 1 - dip * Math.sin(Math.PI * Math.max(0, Math.min(1, f)));
  for (let i = 0; i < 12; i++) out[i] *= k;       // ribbons and heart
  for (let i = 18; i < 21; i++) out[i] *= k;      // caustic
  return out;
}

// A look lit in another colour (a feeling's, from the wheel): the ribbons, heart and
// caustic keep their brightness but take on the colour, and the glass stops
// absorbing it, by `f` (0..1).
export function tintLook(l: LookValues, rgb: readonly number[], f: number): LookValues {
  'worklet';
  if (f <= 0) return l;
  const out = l.slice();
  const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const own = Math.max(0.001, luma(rgb[0], rgb[1], rgb[2]));
  for (const i of [0, 3, 6, 9, 18]) {           // ribA, ribB, ribC, heart, caustic
    const k = luma(l[i], l[i + 1], l[i + 2]) / own;
    for (let c = 0; c < 3; c++) out[i + c] = l[i + c] + (rgb[c] * k - l[i + c]) * f;
  }
  for (let c = 0; c < 3; c++) out[12 + c] = l[12 + c] + (0.08 - l[12 + c]) * f;   // absorb
  return out;
}

// Where every orb's clock starts, so a still (LiquidStill, the welcome's poster)
// is exactly the first frame of the live orb.
export const FIRST_TIME = 3;
export const FIRST_FLOW = FIRST_TIME * 0.22;

// The orb's motion, advanced once a frame. Energy follows the voice up quickly and
// settles slowly; the ribbons' phase is accumulated from it, so a change of speed
// never makes the light jump. (Scaling the clock by the voice did: t × Δspeed.)
export type Motion = { energy: number; flow: number };
export function advanceMotion(m: Motion, level: number, dt: number, press = 0): Motion {
  'worklet';
  const target = Math.max(0, Math.min(1, level));
  const energy = m.energy + (target - m.energy) * (1 - Math.exp(-(target > m.energy ? 10 : 2) * dt));
  // A finger holding the glass stirs the light a little too, as in the lab.
  return { energy, flow: m.flow + dt * (0.22 + 0.3 * Math.min(1, energy + 0.4 * press)) };
}

// A finger on the glass, reported as the Orb Lab reads the mouse: [down 0|1, when it
// went down (ms), and where it asks the orb to move (shader units, where the sphere's
// radius is 0.58; the lab caps it at ±0.14)].
export type Finger = number[];
export const noFinger: Finger = [0, 0, 0, 0];
// The orb's answer to that finger, eased once a frame with the lab's own rates:
// holding (after a beat, so a tap doesn't) breathes in slowly and letting go breathes
// out; the orb follows a drag quickly, the light inside lags behind it, and on
// release it drifts back slowly. No springs, so nothing bounces.
export type Hand = { press: number; sx: number; sy: number };
export const openHand: Hand = { press: 0, sx: 0, sy: 0 };
export function advanceHand(h: Hand, finger: Finger, now: number, dt: number): Hand {
  'worklet';
  const down = finger[0] > 0;
  const holding = down && now - finger[1] > 220;
  const ease = (from: number, to: number, rate: number) => from + (to - from) * (1 - Math.exp(-rate * dt));
  const follow = down ? 10 : 3.5;
  return {
    press: ease(h.press, holding ? 1 : 0, holding ? 1.4 : 2.2),
    sx: ease(h.sx, down ? finger[2] : 0, follow),
    sy: ease(h.sy, down ? finger[3] : 0, follow),
  };
}

// A tap on the glass: where (orb units, y up) and how long ago, for the ripple.
export type Ripple = [x: number, y: number, age: number, strength: number];
export const noRipple: Ripple = [0, 0, 10, 0];

// The uniforms for one frame: a look, the canvas, the sphere's radius in pixels,
// the time, the voice's energy (0..1), the ribbons' phase and the last tap. Flow's
// default is FIRST_FLOW at FIRST_TIME, so a still matches a live orb's first frame.
export function lookUniforms(l: LookValues, size: number, radius: number, time: number, level: number, press = 0, flow = time * 0.22, ripple: Ripple = noRipple, shift: readonly number[] = [0, 0]) {
  'worklet';
  const v3 = (i: number) => [l[i], l[i + 1], l[i + 2]];
  return {
    uRes: [size, size], uRadius: radius, uTime: time, uLevel: level, uPress: press, uFlow: flow, uTouch: ripple, uShift: [shift[0], shift[1]],
    uRibA: v3(0), uRibB: v3(3), uRibC: v3(6), uHeart: v3(9), uAbsorb: v3(12), uBody: v3(15), uCaustic: v3(18), uRimTint: v3(21),
    uHoriz: l[24], uRibW: l[25], uHeartSize: l[26], uFlame: l[27], uFlicker: l[28], uLens: l[29], uBevel: l[30], uAberr: l[31], uWobble: l[32],
  };
}

const head = `
uniform vec2 uRes;
uniform float uRadius;
uniform float uTime;
uniform float uLevel;
uniform float uPress;
uniform float uFlow;
uniform vec4 uTouch;
uniform vec2 uShift;
uniform vec3 uRibA;
uniform vec3 uRibB;
uniform vec3 uRibC;
uniform vec3 uHeart;
uniform vec3 uAbsorb;
uniform vec3 uBody;
uniform vec3 uCaustic;
uniform vec3 uRimTint;
uniform float uHoriz;
uniform float uRibW;
uniform float uHeartSize;
uniform float uFlame;
uniform float uFlicker;
uniform float uLens;
uniform float uBevel;
uniform float uAberr;
uniform float uWobble;
`;

const body = `
float sq(float x){ return x*x; }
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }

// Layer 3, the light inside: three soft ribbons and a warm heart, dimmer toward the
// rim of the ball because they sit inside it. The ribbons drift on uFlow, a phase
// accumulated frame by frame; the voice swells their sway like silk, it never
// speeds up the clock.
vec3 light(vec2 q, float t, float energy){
  vec2 k = mix(q, q.yx, uHoriz);
  float s = uFlow;
  float sway = 1.0 + 0.8*energy;
  float xa = k.x - (-0.42 + 0.10*sin(s*0.5) + 0.16*sway*sin(k.y*2.2 + s));
  float xb = k.x - (0.02 + 0.08*sin(s*0.4 + 2.0) + 0.14*sway*sin(k.y*2.6 - s*1.2 + 1.0));
  float xc = k.x - (0.44 + 0.10*sin(s*0.45 + 4.0) + 0.16*sway*sin(k.y*2.0 + s*0.9 + 2.0));
  float along = 1.0 - smoothstep(0.35, 1.0, abs(k.y));
  vec3 c = (uRibA*exp(-sq(xa/(0.075*uRibW)))*0.8 + uRibB*exp(-sq(xb/(0.042*uRibW))) + uRibC*exp(-sq(xc/(0.06*uRibW)))*0.7)*along;
  vec2 hq = (q - vec2(0.0, -0.18))*vec2(1.0, mix(1.0, 0.45, uFlame));
  float flick = 1.0 + uFlicker*0.12*(sin(t*2.1) + 0.6*sin(t*3.7 + 1.0) + 0.4*sin(t*6.1 + 2.0));
  c += uHeart*exp(-dot(hq, hq)/(uHeartSize*flick))*(0.9 + 0.2*sin(t*0.628));
  float zq = sqrt(max(0.0, 1.0 - dot(q, q)));
  return c*(0.25 + 0.75*zq)*(1.0 + 1.3*energy);
}

// Layer 6's studio: one window up left and a narrow strip at the right edge; black
// everywhere else, so the rim reflects darkness and never becomes an outline.
vec3 studio(vec3 d){
  float key = exp(-sq((d.x + 0.55)/0.045))*smoothstep(-0.25, 0.25, d.y)*(1.0 - smoothstep(0.7, 0.95, d.y));
  return uRimTint*key*1.5;
}

// at: the point relative to the canvas centre, y up, in units where the sphere is 0.58.
// A finger's drag moves the ball a little inside its canvas (uShift).
vec4 orb(vec2 at, float unit){
  vec2 o = at - uShift;
  float t = uTime;
  float breath = 0.5 + 0.5*sin(t*0.628);
  float R = 0.58*(1.0 + 0.012*breath + 0.05*uPress + 0.035*uLevel);
  float ang = atan(o.y, o.x);
  float wob = uWobble*(sin(3.0*ang + t*0.4) + 0.6*sin(5.0*ang - t*0.31 + 1.3)) + uLevel*0.015*sin(4.0*ang + t*2.2);
  float Rw = R*(1.0 + wob);
  vec2 p = o/Rw;
  float r = length(p);
  float aa = 1.5/(Rw*unit);
  // Layer 1, shape: a clean circle.
  float mask = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
  vec3 col = vec3(0.0);
  if (mask > 0.0){
    vec2 pc = p*min(1.0, 0.999/max(r, 0.0001));
    float rc = length(pc);
    vec2 n2 = pc/max(rc, 0.0001);
    // Layer 2, depth: a real sphere, thickest in the middle.
    float z = sqrt(max(0.0, 1.0 - rc*rc));
    // Layer 7, motion: slow surface waves, rings while the voice speaks, and glassy
    // waves running out from the one spot a finger touched, where the glass also
    // dents for a moment (the Orb Lab's touch, exactly).
    float rings = uLevel*sin(12.0*rc - t*5.0)*(1.0 - rc*rc);
    vec2 tp = pc - uTouch.xy;
    float td = max(length(tp), 0.001);
    float age = uTouch.z;
    float ripple = uTouch.w*sin(16.0*td - 7.0*age)*exp(-1.8*td)*exp(-1.1*age)*smoothstep(0.0, 0.05, age);
    float dent = uTouch.w*exp(-td*td/0.05)*exp(-age*2.5);
    vec2 wave = 0.018*vec2(sin(pc.y*4.0 + t*0.5), cos(pc.x*3.6 - t*0.4)) + 0.02*rings*n2 + 0.08*ripple*(tp/td)*smoothstep(0.0, 0.1, td) - 0.22*dent*tp;
    vec3 N = normalize(vec3(pc + wave, z));
    float energy = uLevel*0.8 + uPress*0.4;
    // Layer 5, lens: flat in the middle, bending hard at the rim, colours pulled apart there.
    float bend = uLens*pow(rc, uBevel);
    // The light inside lags behind a drag, so it sloshes like something liquid.
    vec2 base = pc + wave*1.5 - uShift*0.6;
    vec3 inner = light(base*(1.0 - bend), t, energy);
    if (bend*uAberr > 0.002) {
      inner.r = light(base*(1.0 - bend*(1.0 - uAberr)), t, energy).r;
      inner.b = light(base*(1.0 - bend*(1.0 + uAberr)), t, energy).b;
    }
    // The ripple's crests gather a little light, as real glass does.
    inner *= 1.0 + 0.22*ripple;
    // Layer 4, glass: the light seen through tinted glass, deeper where it is thicker.
    col = uBody*z*z + inner*exp(-uAbsorb*2.0*z);
    // The light melts into black over the last few percent of the rim, so the
    // silhouette is never drawn as a line; the lens still bends it just inside.
    float melt = mix(1.0, smoothstep(0.0, 0.32, z), 0.88);
    col *= melt;
    // Layer 6, highlights: the studio in the surface, one sharp glint, a warm caustic
    // near the lower rim, and one short hairline arc up left instead of an outline.
    vec3 Rf = reflect(vec3(0.0, 0.0, -1.0), N);
    float fres = 0.04 + 0.96*pow(1.0 - N.z, 5.0);
    col += studio(Rf)*(0.25 + 0.5*fres);
    col += uRimTint*pow(max(dot(Rf, normalize(vec3(-0.45, 0.55, 0.7))), 0.0), 400.0)*2.5;
    col += uCaustic*exp(-sq((rc - 0.7)/0.07))*pow(max(dot(n2, normalize(vec2(0.35, -0.94))), 0.0), 10.0)*(0.22 + 0.4*energy)*melt;
    float hair = exp(-sq((rc - 0.985)/0.01));
    col += uRimTint*hair*pow(max(dot(n2, vec2(-0.6, 0.8)), 0.0), 24.0)*0.9;
    col *= mask;
  }
  return vec4(pow(aces(col), vec3(1.0/2.2)), mask);
}
`;

const toSkia = (source: string) => source
  .replace(/\bvec2\b/g, 'float2')
  .replace(/\bvec3\b/g, 'float3')
  .replace(/\bvec4\b/g, 'float4');

// Skia: y down from the top-left, alpha premultiplied, so the black around it is clear.
export const liquidSkia = toSkia(`${head}${body}
half4 main(vec2 xy){
  float unit = uRadius/0.58;
  vec4 c = orb(vec2(xy.x - 0.5*uRes.x, 0.5*uRes.y - xy.y)/unit, unit);
  return half4(c.rgb, c.a);
}`);

// WebGL: y up from the bottom-left, in device pixels.
export const liquidGl = `precision highp float;
uniform float uPixelRatio;
${head}${body}
void main(){
  vec2 xy = gl_FragCoord.xy/uPixelRatio;
  float unit = uRadius/0.58;
  vec4 c = orb((xy - 0.5*uRes)/unit, unit);
  gl_FragColor = vec4(c.rgb, c.a);
}`;
