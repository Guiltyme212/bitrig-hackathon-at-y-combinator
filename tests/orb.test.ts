import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceHand, advanceMotion, liquidGl, liquidSkia } from '../src/orb/liquid';

const frame = 1 / 60;
const run = (seconds: number, level: (i: number) => number, from = { energy: 0, flow: 0 }) => {
  let motion = from;
  for (let i = 0; i < Math.round(seconds / frame); i++) motion = advanceMotion(motion, level(i), frame);
  return motion;
};

test('the ribbons are moved by an accumulated phase, never by time × voice', () => {
  // Scaling the clock by the voice made the light jump by t × Δspeed on every
  // syllable (and on every tap, which starts the audition).
  for (const source of [liquidSkia, liquidGl]) {
    assert.match(source, /uniform float uFlow/);
    assert.doesNotMatch(source, /t\s*\*\s*\(\s*0\.22\s*\+\s*0\.5\s*\*\s*energy\s*\)/);
  }
});

test('the light never jumps when the voice starts, however long the orb has been on', () => {
  const quiet = run(600, () => 0);
  const next = advanceMotion(quiet, 1, frame);
  assert.ok(next.flow - quiet.flow < 0.02, `the phase moved ${next.flow - quiet.flow} rad in one frame`);
});

test('a bursty voice only quickens the flow gently', () => {
  const quiet = run(5, () => 0);
  const speaking = run(5, i => (i % 12 < 6 ? 1 : 0.2));
  assert.ok(speaking.flow > quiet.flow, 'speaking should move the light a little more');
  assert.ok(speaking.flow < quiet.flow * 2.5, `speaking moved it ${speaking.flow.toFixed(2)} rad against ${quiet.flow.toFixed(2)} at rest`);
});

test('energy rises with the voice quickly and settles slowly', () => {
  const up = run(0.25, () => 1);
  assert.ok(up.energy > 0.85, `energy only reached ${up.energy.toFixed(2)} after 250 ms`);
  const down = run(0.25, () => 0, up);
  assert.ok(down.energy > 0.45, `energy fell to ${down.energy.toFixed(2)} within 250 ms of silence`);
});

test('a morph starts and ends on the two looks, and dims instead of mixing to mud halfway', async () => {
  const { lookValues, morphLooks } = await import('../src/orb/liquid');
  const ember = lookValues('ember'), night = lookValues('night');
  assert.deepEqual(morphLooks(ember, night, 0), ember);
  assert.deepEqual(morphLooks(ember, night, 1).map(v => +v.toFixed(9)), night.map(v => +v.toFixed(9)));
  const half = morphLooks(ember, night, 0.5, 0.5);
  const plain = ember.map((v, i) => (v + night[i]) / 2);
  assert.ok(Math.abs(half[3] - plain[3] * 0.5) < 1e-9, 'the ribbons should be at half light mid-morph');
  assert.ok(Math.abs(half[12] - plain[12]) < 1e-9, 'the glass tint itself should not dip');
});

test('a feeling tints the light but keeps its brightness', async () => {
  const { lookValues, tintLook } = await import('../src/orb/liquid');
  const ember = lookValues('ember');
  assert.equal(tintLook(ember, [0.3, 0.5, 1], 0), ember);
  const blue = tintLook(ember, [0.3, 0.5, 1], 1);
  const luma = (i: number, l: number[]) => 0.2126 * l[i] + 0.7152 * l[i + 1] + 0.0722 * l[i + 2];
  assert.ok(Math.abs(luma(9, blue) - luma(9, ember)) < 1e-9, 'the heart keeps its brightness');
  assert.ok(blue[11] > blue[9], 'the heart turns blue');
});

// Dan (26 September): in the Orb Lab a press fixes the waves to one spot; on the phone
// they chased the finger all over the glass. The app now reads a finger the lab's way.
const hand = (seconds: number, finger: (t: number) => number[], from = { press: 0, sx: 0, sy: 0 }) => {
  let h = from;
  for (let i = 0; i < Math.round(seconds / frame); i++) h = advanceHand(h, finger(i * frame * 1000), i * frame * 1000, frame);
  return h;
};

test('a quick tap ripples but does not breathe in; holding does, slowly', () => {
  const tap = hand(0.2, () => [1, 0, 0, 0]);
  assert.equal(tap.press, 0, 'no breath before 220 ms of holding');
  const held = hand(1.5, () => [1, 0, 0, 0]);
  assert.ok(held.press > 0.6 && held.press < 0.95, `held for 1.5 s the breath is ${held.press.toFixed(2)}`);
});

test('the orb follows a drag and drifts back on release without overshooting', () => {
  const dragged = hand(0.5, () => [1, 0, 0.14, -0.1]);
  assert.ok(Math.abs(dragged.sx - 0.14) < 0.01 && Math.abs(dragged.sy + 0.1) < 0.01, 'it follows the finger within half a second');
  let h = dragged, lowest = h.sx;
  for (let i = 0; i < 120; i++) { h = advanceHand(h, [0, 0, 0, 0], 1e6, frame); lowest = Math.min(lowest, h.sx); }
  assert.ok(lowest >= 0, 'it never swings past its place');
  assert.ok(h.sx < 0.01, 'it is home within two seconds');
});

test('a touch dents the glass at one spot and a drag moves the ball, in both shaders', () => {
  for (const source of [liquidSkia, liquidGl]) {
    assert.match(source, /uniform (vec2|float2) uShift/);
    assert.match(source, /0\.22\*dent\*tp/);
    assert.match(source, /uShift\*0\.6/);
  }
});
