import test from 'node:test';
import assert from 'node:assert/strict';
import { dragDistance, glassAt, restingGlass, shouldEnter } from '../src/intro/choreography';

// Dan (26 September): the glass rushed to the middle, stopped there for a second,
// then rose again and shrank. It landed on a larger orb mid-screen and held before
// moving to the conversation. Now it goes straight to the orb's place in one move.
const width = 402, height = 874, target = { x: 201, y: 173, r: 90.3 };

test('the glass lands exactly on the orb above the conversation', () => {
  const end = glassAt(1, width, height, target);
  for (const key of ['x', 'y', 'r'] as const) assert.ok(Math.abs(end[key] - target[key]) < 1e-9, `${key} is ${end[key]}`);
});

test('the lift is one move: the glass never holds still before it has landed', () => {
  let last = glassAt(0, width, height, target);
  for (let i = 1; i <= 100; i++) {
    const now = glassAt(i / 100, width, height, target);
    assert.ok(now.y < last.y, `the glass stopped rising at ${i}%`);
    assert.ok(now.r < last.r, `the glass stopped contracting at ${i}%`);
    last = now;
  }
});

test('the glass stays under the finger: its crown rises about 1.15× as fast', () => {
  const drag = dragDistance(width, height, target);
  const crown = (p: number) => { const g = glassAt(p, width, height, target); return g.y - g.r; };
  const ratio = (crown(0) - crown(0.2)) / (0.2 * drag);
  assert.ok(Math.abs(ratio - 1.15) < 0.01, `the crown moves ${ratio.toFixed(2)}× the finger`);
  assert.ok(restingGlass(width, height).r > target.r * 4, 'the welcome glass starts as a horizon, not an orb');
});

test('letting go past a quarter of the lift enters', () => {
  assert.equal(shouldEnter(0.3, 0), true);
  assert.equal(shouldEnter(0.26, -0.2), true);
});

test('a small flick enters from near the bottom', () => {
  assert.equal(shouldEnter(0.05, 1.3), true);
});

test('a short, slow pull falls back', () => {
  assert.equal(shouldEnter(0.15, 0.2), false);
  assert.equal(shouldEnter(0.02, 3), false);
});
