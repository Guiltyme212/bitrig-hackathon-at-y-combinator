import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duoLayout, hitsFold } from '../src/layout/geometry';

const none = { top: 0, right: 0, bottom: 0, left: 0 };
const phoneInsets = { top: 62, right: 0, bottom: 34, left: 0 };

test('every iPhone (and the web, and an iPad) stays a phone', () => {
  for (const [w, h] of [[375, 667], [393, 852], [402, 874], [440, 956], [874, 402], [956, 440], [1024, 1366], [1440, 900], [410, 860]]) {
    const landscape = w > h ? { top: 0, right: 62, bottom: 21, left: 62 } : phoneInsets;
    assert.equal(duoLayout({ w, h }, landscape).geometry, 'phone', `${w}x${h}`);
    assert.equal(duoLayout({ w, h }, none).geometry, 'phone', `${w}x${h} no insets`);
  }
});

test('the Duo poses, as measured on the 27.1 simulator', () => {
  const closed = duoLayout({ w: 466, h: 678 }, { top: 0, right: 84, bottom: 20, left: 0 });
  assert.equal(closed.geometry, 'closed');
  assert.deepEqual(closed.column.rect, { x: 0, y: 0, w: 382, h: 658 });
  assert.equal(closed.fold, null);

  const open = duoLayout({ w: 951, h: 669 }, { top: 0, right: 84, bottom: 20, left: 0 });
  assert.equal(open.geometry, 'openLandscape');
  assert.deepEqual(open.fold?.band, [455.5, 495.5]);
  assert.deepEqual(open.pages?.orb, { x: 0, y: 0, w: 455.5, h: 669 });
  assert.deepEqual(open.pages?.words, { x: 495.5, y: 0, w: 371.5, h: 669 });
  assert.equal(hitsFold(open.pages!.orb, open.fold), false);
  assert.equal(hitsFold(open.pages!.words, open.fold), false);

  const flipped = duoLayout({ w: 951, h: 669 }, { top: 0, right: 0, bottom: 20, left: 84 });
  assert.equal(flipped.pages?.words.x, 84, 'the words page follows the strip');

  const portrait = duoLayout({ w: 669, h: 951 }, { top: 82, right: 0, bottom: 20, left: 0 });
  assert.equal(portrait.geometry, 'openPortrait');
  assert.deepEqual(portrait.fold?.band, [455.5, 495.5]);
  assert.deepEqual(portrait.pages?.orb, { x: 0, y: 82, w: 669, h: 373.5 });
  assert.deepEqual(portrait.pages?.words, { x: 0, y: 495.5, w: 669, h: 435.5 });
});
