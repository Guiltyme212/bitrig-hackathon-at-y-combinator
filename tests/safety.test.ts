import test from 'node:test';
import assert from 'node:assert/strict';
import { completedVideo, failedStatuses } from '../server/higgsfield/result';
import { requestWebMicrophone } from '../src/microphone.web';
import { canContinue, initialAnswers, futureLine, burdenLine, tonightLine } from '../src/flow';

test('failed, canceled, moderated and incomplete generations cannot produce a success URL', () => {
  for (const status of [...failedStatuses, 'queued', 'in_progress', 'unknown']) {
    assert.throws(() => completedVideo(status, 'https://example.com/result.mp4'));
  }
  assert.throws(() => completedVideo('completed'));
  assert.throws(() => completedVideo('completed', 'not a URL'));
  assert.throws(() => completedVideo('completed', 'http://example.com/result.mp4'));
  assert.equal(completedVideo('completed', 'https://example.com/result.mp4'), 'https://example.com/result.mp4');
});

test('web microphone permission immediately stops every returned track', async () => {
  const stopped: number[] = [];
  await requestWebMicrophone({ getUserMedia: async constraints => {
    assert.deepEqual(constraints, { audio: true });
    return { getTracks: () => [0, 1].map(id => ({ stop: () => stopped.push(id) })) } as unknown as MediaStream;
  }});
  assert.deepEqual(stopped, [0, 1]);
});

test('microphone denial remains a rejection and cannot become granted', async () => {
  await assert.rejects(requestWebMicrophone({ getUserMedia: async () => {
    throw new Error('Permission denied');
  }}), /Permission denied/);
});

test('demographics remain optional; reflection requires a deliberate answer', () => {
  for (const step of [3, 4, 5]) assert.equal(canContinue(step, initialAnswers), true);
  for (const step of [6, 7, 8, 9]) assert.equal(canContinue(step, initialAnswers), false);
  const answers = { ...initialAnswers, name: ' Alex ', burdens: ['An overthinking mind'], frequency: 'As soon as I wake up', cost: 'Feeling rested', future: 'A quieter mind' };
  for (const step of [6, 7, 8, 9]) assert.equal(canContinue(step, answers), true);
  assert.match(futureLine(answers), /^Alex,.*a quieter mind/);
  assert.equal(burdenLine(answers), 'Even quiet moments can feel loud.');
});

test('the sound step needs a choice, and tonight’s line names it', () => {
  assert.equal(canContinue(10, initialAnswers), false);
  const answers = { ...initialAnswers, sound: 'Soft rain' };
  assert.equal(canContinue(10, answers), true);
  assert.match(tonightLine(answers), /soft rain underneath/);
  assert.match(tonightLine({ ...initialAnswers, sound: 'Just my voice' }), /just the voice/);
});
