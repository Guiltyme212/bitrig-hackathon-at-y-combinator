import assert from 'node:assert/strict';
import test from 'node:test';
import { createHapticFeedback, type HapticMoment } from '../src/hapticFeedback';

test('disabled and unavailable feedback stays silent without consuming the next tap', async () => {
  let available = false;
  const calls: HapticMoment[] = [];
  const feel = createHapticFeedback({ available: () => available, play: async moment => { calls.push(moment); }, now: () => 0 });
  await feel('select');
  available = true;
  await feel('select', false);
  assert.deepEqual(calls, []);
  await feel('select');
  assert.deepEqual(calls, ['select']);
});

test('rapid events cannot create a buzz or delayed queue; later actions still work', async () => {
  let time = 0;
  const calls: HapticMoment[] = [];
  const feel = createHapticFeedback({ available: () => true, play: async moment => { calls.push(moment); }, now: () => time });
  await feel('select');
  time = 40;
  await feel('advance');
  time = 80;
  await feel('touch');
  assert.deepEqual(calls, ['select']);
  time = 200;
  await feel('advance');
  time = 400;
  await feel('complete');
  assert.deepEqual(calls, ['select', 'advance', 'complete']);
});

test('missing hardware never rejects a UI action, and the next interaction can retry', async () => {
  let time = 0, attempts = 0;
  const feel = createHapticFeedback({ available: () => true, now: () => time, play: async () => { attempts++; throw new Error('Haptic engine unavailable'); } });
  await assert.doesNotReject(feel('touch'));
  time = 200;
  await assert.doesNotReject(feel('advance'));
  assert.equal(attempts, 2);
});
