import test from 'node:test';
import assert from 'node:assert/strict';
import { describe, feelings, impliedFeeling, makingLines, readMind, shortcuts, timeReply } from '../src/stage/script';
import { captions, duckAt } from '../src/voices/mix';

test('the four research scenarios keep the person’s own subject', () => {
  const yc = readMind('I want to get into YC and buy a Lambo.');
  assert.equal(yc.title, 'YC and the Lambo');
  assert.equal(describe(yc, 'motivated', 5), 'Picture what you’re working toward, then bring that energy to your next step.');

  const breakup = readMind('We broke up. I just want to chill.');
  assert.equal(breakup.title, 'A break from thinking about them');
  assert.equal(describe(breakup, 'calmer', 3), 'A few minutes with your attention on something else.');

  const talk = readMind('My presentation is tomorrow and I’m nervous');
  assert.equal(talk.title, 'Tomorrow’s presentation');
  assert.equal(describe(talk, 'confident', 3), 'Rehearse walking in, taking your time, and saying your first sentence.');

  const parent = readMind('I’m tired of everyone needing me');
  assert.equal(parent.title, 'A minute to yourself');
  assert.equal(describe(parent, 'calmer', 1), 'No advice to work through. Just a short pause.');
});

test('ambition is never turned into stress', () => {
  for (const text of ['I want to get into YC', 'Launching my app next week', 'I want to buy a Lambo']) {
    const topic = readMind(text);
    assert.notEqual(topic.kind, 'worry');
    assert.ok(!/stress|anxious|heavy/i.test(topic.reply.join(' ')), topic.reply.join(' '));
  }
});

test('short answers become their own title; long ones are thanked, not paraphrased', () => {
  assert.equal(readMind('moving to Berlin').title, 'Moving to Berlin');
  assert.equal(readMind('so many things happening at once and I can’t tell which matters').title, 'What’s on your mind');
});

test('a shortcut answers the feeling question too; free text asks it', () => {
  for (const s of shortcuts) assert.equal(impliedFeeling(s.label), s.feel);
  assert.equal(impliedFeeling('My presentation is tomorrow'), null);
  assert.equal(new Set(feelings.map(f => f.id)).size, feelings.length);
});

test('time and making copy', () => {
  assert.equal(timeReply(1), 'One minute. Short, and complete.');
  assert.deepEqual(makingLines(readMind('My presentation is tomorrow'), 'Natasha', 'Soft ocean textures'),
    ['Writing “Tomorrow’s presentation”', 'Recording Natasha’s voice', 'Adding soft ocean textures', 'Finding the pauses']);
});

test('ducking matches the listening room: floor under speech, 1.5 s ramps', () => {
  const timeline = [{ start: 8, end: 20, text: 'One. Two.' }];
  assert.equal(duckAt(0, timeline, 0.447), 1);
  assert.equal(duckAt(10, timeline, 0.447), 0.447);
  assert.ok(Math.abs(duckAt(7.25, timeline, 0.28) - (0.28 + 0.72 * 0.5)) < 1e-9);
  assert.ok(Math.abs(duckAt(20.75, timeline, 0.28) - (0.28 + 0.72 * 0.5)) < 1e-9);
  assert.equal(duckAt(30, timeline, 0.28), 1);
});

test('a short phrase is one caption; a long passage is split into timed sentences', () => {
  // Dan (26 September): splitting every phrase into sentences flashed words past too fast.
  const short = captions([{ start: 8, end: 12, text: 'Take a seat. Let your shoulders drop.' }]);
  assert.deepEqual(short.map(l => l.text), ['Take a seat. Let your shoulders drop.']);
  const long = 'Take a seat and let the chair hold you for a while. Let your shoulders drop, a little more with every breath out. Notice the room around you, the sounds, the air on your skin.';
  const lines = captions([{ start: 8, end: 38, text: long }]);
  assert.equal(lines.length, 3);
  assert.equal(lines[0].start, 8);
  assert.ok(Math.abs(lines[2].end - 38) < 1e-9);
});
