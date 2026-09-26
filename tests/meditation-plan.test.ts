import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCaption, layout, sanitizePhrases, timing, wordBudget } from '../server/meditation/plan';
import { speechRegions } from '../src/meditation/mix';

const near = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} ≠ ${b}`);

test('phrases are placed with their pauses, scaled to fill the session', () => {
  const out = layout([
    { text: 'One.', duration: 4, pause: 2 },
    { text: 'Two.', duration: 5, pause: 3 },
    { text: 'Three.', duration: 6, pause: 9 },
  ], { target: 40, intro: 5, outro: 5 });
  // 15 s of speech, 5 s of pauses asked for, 15 s free: the pauses grow, but only to 1.6×.
  near(out.timeline[0].start, 5, 'first phrase waits for the intro');
  near(out.timeline[1].start, 5 + 4 + 3.2, 'second phrase');
  near(out.timeline[2].start, 5 + 4 + 3.2 + 5 + 4.8, 'third phrase');
  near(out.duration, 5 + 4 + 3.2 + 5 + 4.8 + 6 + 5, 'the last pause becomes the outro');
  assert.deepEqual(out.timeline.map(s => s.text), ['One.', 'Two.', 'Three.']);
});

test('too much speech shortens the connecting pauses first, never the breaths', () => {
  const out = layout([
    { text: 'Breathe in.', duration: 50, pause: 6 },      // a practice pause: kept as asked
    { text: 'Another.', duration: 50, pause: 3 },         // connective: shrinks, but only to half
    { text: 'And.', duration: 2, pause: 0.1 },            // never below the floor
    { text: 'End.', duration: 3, pause: 4 },
  ], { target: 60, intro: 4, outro: 5 });
  const gaps = out.timeline.slice(1).map((s, i) => s.start - out.timeline[i].end);
  near(gaps[0], 6, 'the breath keeps its time');
  near(gaps[1], 3 * 0.5, 'connective pauses stop shrinking at 0.5×');
  near(gaps[2], 0.6, 'a pause is at least 0.6 s');
  assert.ok(out.duration > 60, 'the session runs long rather than rushing the listener');
});

test('with room to spare, every pause grows together', () => {
  const out = layout([
    { text: 'One.', duration: 5, pause: 6 },
    { text: 'Two.', duration: 5, pause: 2 },
    { text: 'Three.', duration: 5, pause: 1 },
  ], { target: 40, intro: 5, outro: 5 });
  const gaps = out.timeline.slice(1).map((s, i) => s.start - out.timeline[i].end);
  near(gaps[0], 6 * 1.6, 'breath pause grows');
  near(gaps[1], 2 * 1.6, 'connective pause grows by the same factor');
});

test('captions lose the delivery tags', () => {
  assert.equal(cleanCaption('[warmly] Okay.  You’re here.'), 'Okay. You’re here.');
  assert.equal(cleanCaption('Breathe [exhales] out.'), 'Breathe out.');
});

test('only a few known delivery tags survive, and empty phrases go', () => {
  const out = sanitizePhrases([
    { text: '[music swells] Breathe in.', pause: 5 },
    { text: '[gently] Let it go.', pause: 90 },
    { text: '[pause]', pause: 3 },
    { text: '   ', pause: 1 },
    { text: 'Stay.', pause: -2 },
  ]);
  assert.deepEqual(out.map(p => p.text), ['Breathe in.', '[gently] Let it go.', 'Stay.']);
  assert.deepEqual(out.map(p => p.pause), [5, 22, 0.6]);
});

test('the music dips once for a run of close phrases, and returns in the long silences', () => {
  const regions = speechRegions([
    { start: 7, end: 10, text: 'a' }, { start: 11.5, end: 14, text: 'b' },   // 1.5 s apart: one stretch
    { start: 21, end: 24, text: 'c' },                                         // 7 s of breathing first
  ]);
  assert.deepEqual(regions.map(r => [r.start, r.end]), [[7, 14], [21, 24]]);
});

test('the word budget leaves room for silence', () => {
  assert.equal(wordBudget(3), 230);
  assert.ok(wordBudget(1) < wordBudget(3) && wordBudget(3) < wordBudget(5) && wordBudget(5) < wordBudget(10));
  const t = timing(3);
  assert.equal(t.target, 180);
  assert.ok(t.intro >= 5 && t.outro >= 8, 'music plays alone at both ends');
  assert.ok(timing(1).intro < t.intro, 'a one-minute session starts sooner');
});

test('making lines follow the stage and never read back what they said', async () => {
  const { makingLines, nextLine, stageOf } = await import('../src/making/lines');
  const lines = makingLines('Natasha');
  assert.ok(lines.writing.includes('Consulting with the monks'));
  assert.ok(lines.recording.includes('Natasha is recording'));
  assert.equal(stageOf('written'), 'writing');
  assert.equal(stageOf('recording'), 'recording');
  assert.equal(stageOf('ready'), 'mixing');
  // Round again from the second line; the last stage rests on its last line.
  assert.equal(nextLine('writing', lines.writing.length - 1, lines.writing.length), 1);
  assert.equal(nextLine('mixing', lines.mixing.length - 1, lines.mixing.length), lines.mixing.length - 1);
});

test('dreams and big moments get a lift meditation', async () => {
  const { outcomeFor } = await import('../src/meditation/brief');
  assert.equal(outcomeFor('confident', 'other'), 'lift');
  assert.equal(outcomeFor(null, 'ambition'), 'lift');
  assert.equal(outcomeFor(null, 'work'), 'clarity');
  const { writerMessages } = await import('../server/meditation/writer');
  const [system] = writerMessages({ situation: 'At YC, hoping to get in.', words: [], outcome: 'lift', minutes: 3 });
  assert.match(system.content, /LIFT\./);
  assert.match(system.content, /never upgrade their story/);
});

test('a long session keeps its ending', () => {
  const many = Array.from({ length: 130 }, (_, i) => ({ text: `Phrase ${i + 1}.`, pause: 2 }));
  const kept = sanitizePhrases(many);
  assert.equal(kept.length, 130);
  assert.equal(kept[kept.length - 1].text, 'Phrase 130.');
});
